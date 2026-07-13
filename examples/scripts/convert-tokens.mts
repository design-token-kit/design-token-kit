/**
 * Converts the example DTCG token files into a single CSS output file.
 */
import { writeFile } from "node:fs/promises";

import { DtcgTokenCssConverter } from "@design-token-kit/core";

const css = await new DtcgTokenCssConverter().convert([
    "./src/styles/tokens/tokens.dtcg.json",
    "./src/styles/tokens/tokens.dark.dtcg.json",
]);

await writeFile("./src/styles/tokens/tokens.css", css, "utf8");

console.log("Generated ./src/styles/tokens/tokens.css");
