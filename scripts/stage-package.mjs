import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const packageOutputs = {
    core: ["lib"],
    cli: ["bin"],
};

const packageName = process.argv[2];
const outputs = packageOutputs[packageName];

if (!outputs) {
    throw new Error(`Unknown package "${packageName}". Expected one of: ${Object.keys(packageOutputs).join(", ")}`);
}

const packageDir = path.join(rootDir, packageName);
const distDir = path.join(packageDir, "build", "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await cp(path.join(packageDir, "package.json"), path.join(distDir, "package.json"));

for (const output of outputs) {
    await cp(path.join(packageDir, output), path.join(distDir, output), { recursive: true });
}
