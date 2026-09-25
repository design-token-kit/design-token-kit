import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(scriptDir, "../core/lib/browser.js");
const typesPath = path.resolve(scriptDir, "../core/lib/browser.d.ts");
const browserBundle = await readFile(bundlePath, "utf8");
const browserTypes = await readFile(typesPath, "utf8");

const builtins = new Set(builtinModules.flatMap((name) => [name, name.split("/")[0]]));
const specifiers = [
    ...browserBundle.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g),
].map((match) => match[1]);
const nodeImports = specifiers.filter((specifier) => (
    specifier.startsWith("node:") || builtins.has(specifier) || builtins.has(specifier.split("/")[0])
));
if (nodeImports.length > 0) {
    throw new Error(`Browser bundle must not import Node.js built-in modules: ${[...new Set(nodeImports)].join(", ")}.`);
}

if (!browserTypes.includes("constructor(issues: readonly CheckIssue[]);")) {
    throw new Error("Browser validation error declaration is missing its public constructor.");
}

await import(new URL("../core/lib/browser.js", import.meta.url));

console.log("Browser bundle imports without Node.js built-ins or eager DOM access.");
