import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

/**
 * Reports whether each dependency override of the root package.json is still needed.
 *
 * An override is removable when the latest release of each dependent accepts the forced version by itself.
 * Node.js compatibility is checked against the minimal Node.js version the project supports.
 * Requires access to the npm registry.
 * The script only prints a report and never changes files or fails because of an outdated override.
 */

const OverrideStatus = Object.freeze({
    REQUIRED: "still required",
    BLOCKED_BY_NODE: "removable after raising the supported Node.js version",
    REMOVABLE: "removable after updating the dependents",
});

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(readFileSync(path.join(projectDir, "package.json"), "utf8"));
const projectMinNodeVersion = semver.minVersion(rootPackage.engines?.node ?? "*");

printOverrideAssessments(parseOverrides(rootPackage.overrides ?? {}).map(assessOverride));

function printOverrideAssessments(assessments) {
    if (assessments.length === 0) {
        console.log("No dependency overrides.");
        return;
    }
    for (const { override, status, dependents } of assessments) {
        console.log(`Override ${override.key} -> ${override.version}: ${status}`);
        for (const dependent of dependents) {
            console.log(`    ${describeDependent(override, dependent)}`);
        }
    }
}

function assessOverride(override) {
    const dependents = findDependentNames(override).map((name) => assessDependent(override, name));
    return { override, status: resolveStatus(dependents), dependents };
}

function assessDependent(override, name) {
    const latest = npmJson(["view", `${name}@latest`, "version", "dependencies", "engines"]);
    const latestRange = latest.dependencies?.[override.name];
    const latestNodeRange = latest.engines?.node ?? "*";
    return {
        name,
        latestVersion: latest.version,
        latestRange,
        latestNodeRange,
        acceptsOverrideVersion: latestRange === undefined || semver.satisfies(override.version, latestRange),
        supportsProjectNode: semver.satisfies(projectMinNodeVersion, latestNodeRange),
    };
}

function resolveStatus(dependents) {
    if (dependents.some((dependent) => !dependent.acceptsOverrideVersion)) {
        return OverrideStatus.REQUIRED;
    }
    if (dependents.some((dependent) => !dependent.supportsProjectNode)) {
        return OverrideStatus.BLOCKED_BY_NODE;
    }
    return OverrideStatus.REMOVABLE;
}

function describeDependent(override, dependent) {
    const requirement = dependent.latestRange === undefined
        ? `no longer depends on ${override.name}`
        : `requires ${override.name}@${dependent.latestRange}`;
    const nodeNote = dependent.supportsProjectNode ? "" : `, needs Node.js ${dependent.latestNodeRange}`;
    return `${dependent.name}@${dependent.latestVersion} ${requirement}${nodeNote}`;
}

/**
 * Names of installed packages whose own dependency on the overridden package falls under the override selector.
 */
function findDependentNames(override) {
    const selector = override.parentName === null
        ? `:has(> [name="${override.name}"])`
        : `[name="${override.parentName}"]`;
    const dependentNames = npmJson(["query", selector])
        .filter((node) => dependsWithinSelector(node, override))
        .map((node) => node.name);
    return [...new Set(dependentNames)];
}

function dependsWithinSelector(node, override) {
    const declaredRange = node.dependencies?.[override.name];
    return declaredRange !== undefined && semver.intersects(declaredRange, override.selectorRange);
}

/**
 * Flattens the npm "overrides" field into a list of forced versions.
 *
 * Supports top-level entries ("name@range": "version") and entries nested under one parent package.
 */
function parseOverrides(overridesField) {
    return Object.entries(overridesField).flatMap(([key, value]) => {
        if (typeof value === "string") {
            return [parseOverride(key, value, null)];
        }
        const parentName = parseSelector(key).name;
        return Object.entries(value).map(([childKey, childValue]) => parseOverride(childKey, childValue, parentName));
    });
}

function parseOverride(key, version, parentName) {
    const { name, selectorRange } = parseSelector(key);
    const displayKey = parentName === null ? key : `${parentName} > ${key}`;
    return { key: displayKey, name, selectorRange, version, parentName };
}

function parseSelector(key) {
    const versionSeparatorIndex = key.lastIndexOf("@");
    if (versionSeparatorIndex <= 0) {
        return { name: key, selectorRange: "*" };
    }
    return {
        name: key.slice(0, versionSeparatorIndex),
        selectorRange: key.slice(versionSeparatorIndex + 1),
    };
}

function npmJson(args) {
    const npmCliPath = process.env.npm_execpath;
    if (!npmCliPath) {
        throw new Error("npm_execpath is not set, run the script via npm run check:overrides");
    }
    const output = execFileSync(process.execPath, [npmCliPath, ...args, "--json"], {
        cwd: projectDir,
        encoding: "utf8",
    });
    return JSON.parse(output);
}
