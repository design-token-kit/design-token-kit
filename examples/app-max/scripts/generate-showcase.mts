/**
 * Builds an HTML showcase page from the example token files.
 */
import { mkdir, writeFile } from "node:fs/promises";

import { createTokenHtmlShowcase } from "@design-token-kit/core";

const html = await createTokenHtmlShowcase().showcase([
    "./src/styles/tokens/tokens.json",
    "./src/styles/tokens/tokens.dark.json",
]);

await mkdir("./dist", { recursive: true });
await writeFile("./dist/showcase.html", html, "utf8");

console.log("Generated ./dist/showcase.html");
