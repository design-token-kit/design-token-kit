/**
 * Builds an HTML showcase page from the example token files.
 */
import { mkdir, writeFile } from "node:fs/promises";

import { createTokenHtmlShowcase } from "@design-token-kit/core";

const html = await createTokenHtmlShowcase().showcase([
    "./src/styles/tokens/tokens.dtcg.json",
    "./src/styles/tokens/tokens.dark.dtcg.json",
]);

await mkdir("./dist", { recursive: true });
await writeFile("./dist/showcase.html", html, "utf8");

console.log("Generated ./dist/showcase.html");
