#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DtcgJsonReader, DtcgList, DtcgTokenSwiftUiConverter } from "@design-token-kit/core";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const fixtureDir = resolve(here, "fixtures/swiftui-compile");

// Token files to compile. Defaults to the bundled base + dark theme sample; an
// optional first CLI argument overrides the base (resolved against the current
// working directory) and disables the theme, e.g.
// `npm run verify:swift -- path/to/tokens.json`.
const defaultBase = resolve(here, "fixtures/sample-tokens.json");
const defaultDark = resolve(here, "fixtures/sample-tokens.dark.json");
const tokensArg = process.argv[2];
const basePath = tokensArg ? resolve(process.cwd(), tokensArg) : defaultBase;
const darkPath = tokensArg ? undefined : defaultDark;

// The fixture tree holds only static sources (Package.swift + the SwiftUI
// shim). Building copies it into an ignored build/ directory and generates
// Tokens.swift there, so nothing is ever written into the source tree.
const buildDir = resolve(root, "build/swiftui-compile");
const outPath = resolve(buildDir, "Sources/GeneratedTokens/Tokens.swift");

function hasSwift() {
    const probe = spawnSync("swift", ["--version"], { stdio: "ignore" });
    return probe.status === 0;
}

if (!hasSwift()) {
    console.log("verify:swift skipped: swift toolchain not found");
    process.exit(0);
}

function fail(message) {
    console.error(`verify:swift failed: ${message}`);
    process.exit(1);
}

console.log(`Verifying tokens: ${basePath}${darkPath ? ` (+ dark theme: ${darkPath})` : ""}`);

// Build a DtcgList explicitly from the base document plus an optional dark
// theme, so the compile check exercises themed output, not just a single doc.
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

// Generate and compile each SwiftUI output form. A failure in either form
// fails the whole check.
for (const swiftType of ["enum", "struct"]) {
    verifyForm(swiftType, list);
}

console.log("verify:swift passed: enum and struct SwiftUI forms compile");

function verifyForm(swiftType, list) {
    console.log(`Verifying SwiftUI form: ${swiftType}`);

    let swift;
    try {
        swift = new DtcgTokenSwiftUiConverter({ swiftType }).convertList(list);
    } catch (error) {
        fail(`could not generate ${swiftType} SwiftUI: ${error.message}`);
    }

    rmSync(buildDir, { recursive: true, force: true });
    cpSync(fixtureDir, buildDir, { recursive: true });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, swift, "utf8");
    console.log(`Generated ${outPath} (${swiftType})`);

    try {
        execFileSync("swift", ["build", "--package-path", buildDir], { stdio: "inherit" });
    } catch {
        // swift build already printed its diagnostics via inherited stdio.
        fail(`generated ${swiftType} SwiftUI code does not compile (see swift build output above)`);
    }
    console.log(`verify:swift: ${swiftType} form compiles`);
}
