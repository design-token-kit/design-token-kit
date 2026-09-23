import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(scriptDir, "../core/lib/browser.js");
const typesPath = path.resolve(scriptDir, "../core/lib/browser.d.ts");
const browserBundle = await readFile(bundlePath, "utf8");
const browserTypes = await readFile(typesPath, "utf8");

if (/(?:from\s*["']node:|import\s*\(\s*["']node:|import\s*["']node:)/.test(browserBundle)) {
    throw new Error("Browser bundle must not import Node.js built-in modules.");
}

if (!browserTypes.includes("constructor(issues: readonly CheckIssue[]);")) {
    throw new Error("Browser validation error declaration is missing its public constructor.");
}

await import(new URL("../core/lib/browser.js", import.meta.url));

console.log("Browser bundle imports without Node.js built-ins or eager DOM access.");
