import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmExecPath = process.env.npm_execpath;

run("npm", ["whoami"], rootDir);
run("npm", ["publish", "--access", "public"], path.join(rootDir, "core", "build", "dist"));
run("npm", ["publish", "--access", "public"], path.join(rootDir, "cli", "build", "dist"));

function run(command, args, cwd) {
    if (command === "npm") {
        if (!npmExecPath) {
            throw new Error("npm_execpath is not set. Run this script through npm.");
        }

        execFileSync(process.execPath, [npmExecPath, ...args], {
            cwd,
            stdio: "inherit",
        });
        return;
    }

    execFileSync(command, args, {
        cwd,
        stdio: "inherit",
    });
}
