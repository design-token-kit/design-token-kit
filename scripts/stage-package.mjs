import { loadProject } from "./project.mjs";

const name = process.argv[2];

if (!name) {
    throw new Error("Usage: node stage-package.mjs <workspace-dir>");
}

await loadProject().workspace(name).stage();
