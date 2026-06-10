import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
    "core/lib",
    "core/build",
    "cli/bin",
    "cli/build",
];

await Promise.all(targets.map((target) => rm(path.join(rootDir, target), { recursive: true, force: true })));
