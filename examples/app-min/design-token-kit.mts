import { DtcgChecker, DtcgTokenCssConverter, createTokenHtmlShowcase } from "@design-token-kit/core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const tokenFiles = [
    "./src/styles/tokens/tokens.json",
    "./src/styles/tokens/tokens.dark.json",
];
const cssFile = "./src/styles/tokens/tokens.css";
const showcaseFile = "./dist/showcase.html";

const command = process.argv[2];

switch (command) {
    case "check":
        await check();
        break;
    case "convert":
        await convert();
        break;
    case "showcase":
        await showcase();
        break;
    default:
        console.error("Usage: node --import tsx design-token-kit.mts <check|convert|showcase>");
        process.exit(1);
}

async function check(): Promise<void> {
    const issues = await new DtcgChecker().validate(tokenFiles);

    for (const issue of issues) {
        console.log(issue.severity, issue.sourcePath, issue.tokenPath?.toString(), issue.message);
    }

    if (issues.some((issue) => issue.severity === "error")) {
        process.exit(2);
    }
}

async function convert(): Promise<void> {
    const css = await new DtcgTokenCssConverter().convert(tokenFiles);
    await writeFile(cssFile, css, "utf8");
}

async function showcase(): Promise<void> {
    const html = await createTokenHtmlShowcase().showcase(tokenFiles);

    await mkdir(dirname(showcaseFile), { recursive: true });
    await writeFile(showcaseFile, html, "utf8");
}
