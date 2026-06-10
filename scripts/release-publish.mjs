import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

run("npm", ["whoami"], rootDir);
run("npm", ["publish", "--access", "public"], path.join(rootDir, "core", "build", "dist"));
run("npm", ["publish", "--access", "public"], path.join(rootDir, "cli", "build", "dist"));

function run(command, args, cwd) {
    execFileSync(command, args, {
        cwd,
        stdio: "inherit",
    });
}
