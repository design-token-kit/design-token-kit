import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { Source, createTokenHtmlShowcase } from "@design-token-kit/core";

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

export const showcaseCommand = new Command("showcase")
    .description("Create HTML showcase from DTCG JSON, HRDT YAML, or CSS.")
    .argument("<files...>", "Paths to token JSON, HRDT, or CSS files")
    .option("-o, --out <file>", "Output HTML file name or path")
    .action(async (files: string[], options: { out?: string }) => {
        try {
            const showcase = createTokenHtmlShowcase();
            const sources = files.map((f) => new Source(f));
            const filePaths = await Promise.all(sources.map((s) => s.getFile()));
            const html = await showcase.showcase(filePaths);
            if (options.out) {
                const targetFile = resolveOutputPath(options.out);
                await writeFile(targetFile, html);
                console.log(`Saved HTML to: ${targetFile}`);
                openFile(targetFile);
            } else {
                process.stdout.write(html);
            }
        } catch (error) {
            console.error("Showcase failed:", (error as Error).message);
            process.exit(1);
        }
    });
