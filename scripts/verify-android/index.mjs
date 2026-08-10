#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AndroidTokenConverter, DtcgJsonReader, DtcgList } from "@design-token-kit/core";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const fixtureDir = resolve(here, "fixtures/android-resources");

// Token files to verify. Defaults to the bundled base + dark theme sample; an
// optional first CLI argument overrides the base (resolved against the current
// working directory) and disables the theme, e.g.
// `npm run verify:android -- path/to/tokens.json`.
const defaultBase = resolve(here, "fixtures/sample-tokens.json");
const defaultDark = resolve(here, "fixtures/sample-tokens.dark.json");
const tokensArg = process.argv[2];
const basePath = tokensArg ? resolve(process.cwd(), tokensArg) : defaultBase;
const darkPath = tokensArg ? undefined : defaultDark;

// The fixture tree holds only the static manifest. Verifying copies it into an
// ignored build/ directory and generates the resource tree there, so nothing
// is ever written into the source tree.
const buildDir = resolve(root, "build/android-verify");

/**
 * Locates the aapt2 executable, preferring one on PATH and falling back to the
 * highest build-tools revision of a local Android SDK.
 */
function findAapt2() {
    if (spawnSync("aapt2", ["version"], { stdio: "ignore" }).status === 0) return "aapt2";

    const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
    if (!sdk) return undefined;

    let revisions;
    try {
        revisions = readdirSync(join(sdk, "build-tools")).sort().reverse();
    } catch {
        return undefined;
    }

    for (const revision of revisions) {
        const candidate = join(sdk, "build-tools", revision, "aapt2");
        if (spawnSync(candidate, ["version"], { stdio: "ignore" }).status === 0) return candidate;
    }
    return undefined;
}

const aapt2 = findAapt2();
if (!aapt2) {
    console.log("verify:android skipped: aapt2 not found (set ANDROID_HOME or add aapt2 to PATH)");
    process.exit(0);
}

function fail(message) {
    console.error(`verify:android failed: ${message}`);
    process.exit(1);
}

console.log(`Verifying tokens: ${basePath}${darkPath ? ` (+ dark theme: ${darkPath})` : ""}`);

// Build a DtcgList explicitly from the base document plus an optional dark
// theme, so the check exercises themed output and its values-night directory,
// not just a single document.
let list;
try {
    const reader = new DtcgJsonReader();
    const base = reader.parse(readFileSync(basePath, "utf8"));
    const themes = darkPath
        ? new Map([["dark", reader.parse(readFileSync(darkPath, "utf8"))]])
        : new Map();
    list = new DtcgList(base, themes);
} catch (error) {
    fail(`could not read token sources: ${error.message}`);
}

// Verify every resource file layout. A failure in either layout fails the
// whole check, since both are user-selectable output.
for (const layout of ["layer", "type"]) {
    verifyLayout(layout, list);
}

console.log("verify:android passed: layer and type layouts link with aapt2");

function verifyLayout(layout, list) {
    console.log(`Verifying Android layout: ${layout}`);

    let outputs;
    try {
        outputs = new AndroidTokenConverter({ layout }).convertResourceList(list);
    } catch (error) {
        fail(`could not generate ${layout} resources: ${error.message}`);
    }

    const resDir = resolve(buildDir, "res");
    rmSync(buildDir, { recursive: true, force: true });
    cpSync(fixtureDir, buildDir, { recursive: true });

    for (const output of outputs) {
        const filePath = resolve(resDir, output.filePath);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, output.content, "utf8");
    }
    console.log(`Generated ${outputs.length} resource files in ${resDir} (${layout})`);

    compile(resDir, resolve(buildDir, "compiled.zip"), layout);
    link(resolve(buildDir, "compiled.zip"), resolve(buildDir, "AndroidManifest.xml"), layout);
    console.log(`verify:android: ${layout} layout links`);
}

/**
 * Compiles the resource tree. This validates XML syntax, resource element
 * names and resource name conventions.
 */
function compile(resDir, outPath, layout) {
    try {
        execFileSync(aapt2, ["compile", "--dir", resDir, "-o", outPath], { stdio: "inherit" });
    } catch {
        // aapt2 already printed its diagnostics via inherited stdio.
        fail(`generated ${layout} resources do not compile (see aapt2 output above)`);
    }
}

/**
 * Links the compiled resources. This is the step that resolves every
 * `@color/...` and `@dimen/...` reference and rejects duplicate resources, so
 * it catches dangling references a per-file check cannot see.
 */
function link(compiledPath, manifestPath, layout) {
    const args = [
        "link",
        "-o", resolve(buildDir, "resources.apk"),
        "--manifest", manifestPath,
        "--auto-add-overlay",
    ];

    const androidJar = findAndroidJar();
    if (androidJar) args.push("-I", androidJar);

    args.push(compiledPath);

    try {
        execFileSync(aapt2, args, { stdio: "inherit" });
    } catch {
        // aapt2 already printed its diagnostics via inherited stdio.
        fail(`generated ${layout} resources do not link (see aapt2 output above)`);
    }
}

/**
 * Locates an android.jar to link against, preferring the highest installed
 * platform. Linking works without it for a resource-only package, so a missing
 * jar is not an error.
 */
function findAndroidJar() {
    const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
    if (!sdk) return undefined;

    try {
        const platforms = readdirSync(join(sdk, "platforms")).sort().reverse();
        for (const platform of platforms) {
            const jar = join(sdk, "platforms", platform, "android.jar");
            readFileSync(jar);
            return jar;
        }
    } catch {
        return undefined;
    }
    return undefined;
}
