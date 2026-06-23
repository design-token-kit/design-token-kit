import { Command } from "commander";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import {
    createTokenStats,
    TokenStatsBuilder,
    TokenStatsHtmlRenderer,
} from "@design-token-kit/core";

const EXIT_FAILURE = 1;

type StatsOptions = {
    out?: string;
    open?: boolean;
};

export const statsCommand = new Command("stats")
    .description("Show token statistics for DTCG JSON or HRDT YAML token files.")
    .argument("[files...]", "Paths to token JSON or HRDT YAML files (reads from stdin when omitted)")
    .option("-o, --out <file>", "Output HTML file name or path")
    .option("--open", "Open the generated HTML in browser (only with --out)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  stats failed")
    .action(async (files: string[], options: StatsOptions) => {
        try {
            const tokenStats = createTokenStats();
            const sources = files.length > 0 ? files : ["-"];

            if (options.open && !options.out) {
                throw new Error("Option --open requires --out");
            }

            if (options.out) {
                const targetFile = resolveOutputPath(options.out);
                const html = new TokenStatsHtmlRenderer().render(
                    await (tokenStats as TokenStatsBuilder).collect(sources),
                );
                await writeFile(targetFile, html);
                console.log(`Saved HTML to: ${targetFile}`);
                if (options.open) {
                    openFile(targetFile);
                }
                return;
            }

            process.stdout.write(await tokenStats.stats(sources));
        } catch (error) {
            console.error("Stats failed:", (error as Error).message);
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

    return path.join(process.cwd(), output);
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
