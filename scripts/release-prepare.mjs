import { loadProject, Release } from "./project.mjs";

const version = process.argv[2];

if (!version) {
    throw new Error("Usage: npm run release:prepare -- <version>");
}

new Release(loadProject()).prepare(version);
