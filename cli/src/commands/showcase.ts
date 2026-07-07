import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { createTokenHtmlShowcase } from "@design-token-kit/core";

const EXIT_FAILURE = 1;

export const showcaseCommand = new Command("showcase")
    .description("Create HTML showcase from DTCG JSON, HRDT YAML, DESIGN.md, or CSS.")
    .argument("[files...]", "Paths to token JSON, HRDT YAML, DESIGN.md, or CSS files (reads from stdin when omitted)")
    .option("-o, --out <file>", "Output HTML file name or path")
    .option("--open", "Open the generated HTML in browser (only with --out)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  showcase failed")
    .action(async (files: string[], options: { out?: string; open?: boolean }) => {
        try {
            const showcase = createTokenHtmlShowcase();
            const sources = files.length > 0 ? files : ["-"];

            if (options.open && !options.out) {
                throw new Error("Option --open requires --out");
            }

            const html = await showcase.showcase(sources);
            if (options.out) {
                const targetFile = resolveOutputPath(options.out);
                await writeFile(targetFile, html);
                console.log(`Saved HTML to: ${targetFile}`);
                if (options.open) {
                    openFile(targetFile);
                }
            } else {
                process.stdout.write(html);
            }
        } catch (error) {
            console.error("Showcase failed:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

function resolveOutputPath(output: string): string {
    if (path.isAbsolute(output)) {
        return output;
    }

    if (path.dirname(output) !== ".") {
        return output;
    }

    return path.join(tmpdir(), output);
}

function openFile(filePath: string): void {
    const platform = process.platform;
    if (platform === "win32") {
        spawn("cmd", ["/c", "start", "", filePath], { stdio: "ignore", detached: true });
        return;
    }

    if (platform === "darwin") {
        spawn("open", [filePath], { stdio: "ignore", detached: true });
        return;
    }

    spawn("xdg-open", [filePath], { stdio: "ignore", detached: true });
}
