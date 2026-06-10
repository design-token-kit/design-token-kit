import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version) {
    throw new Error("Usage: npm run release:prepare -- <version>");
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version "${version}". Expected semver, for example 0.1.0`);
}

ensureCleanWorktree();

updatePackageJson(path.join(rootDir, "package.json"), (pkg) => {
    pkg.version = version;
});

updatePackageJson(path.join(rootDir, "core", "package.json"), (pkg) => {
    pkg.version = version;
});

updatePackageJson(path.join(rootDir, "cli", "package.json"), (pkg) => {
    pkg.version = version;
    pkg.dependencies["@design-token-kit/core"] = version;
});

run("npm", ["run", "build"], rootDir);
run("npm", ["test"], rootDir);
run("npm", ["run", "dist"], rootDir);
run("npm", ["pack", "--dry-run"], path.join(rootDir, "core", "build", "dist"));
run("npm", ["pack", "--dry-run"], path.join(rootDir, "cli", "build", "dist"));

const filesToCommit = [
    "package.json",
    path.join("core", "package.json"),
    path.join("cli", "package.json"),
];

if (existsSync(path.join(rootDir, "package-lock.json"))) {
    filesToCommit.push("package-lock.json");
}

run("git", ["add", ...filesToCommit], rootDir);
run("git", ["commit", "-m", `release: v${version}`], rootDir);
run("git", ["tag", `v${version}`], rootDir);

function ensureCleanWorktree() {
    const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: rootDir,
        encoding: "utf8",
    }).trim();

    if (status.length > 0) {
        throw new Error("Working tree must be clean before preparing a release.");
    }
}

function updatePackageJson(filePath, mutate) {
    const content = readFileSync(filePath, "utf8");
    const pkg = JSON.parse(content);
    mutate(pkg);
    writeFileSync(filePath, `${JSON.stringify(pkg, null, 4)}\n`, "utf8");
}

function run(command, args, cwd) {
    execFileSync(resolveCommand(command), args, {
        cwd,
        stdio: "inherit",
    });
}

function resolveCommand(command) {
    if (process.platform !== "win32") {
        return command;
    }

    if (command === "npm") {
        return "npm.cmd";
    }

    return command;
}
