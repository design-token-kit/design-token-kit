import { Command } from "commander";
import { Source } from "@design-token-kit/core";
import { writeFile } from "node:fs/promises";
import { getReader, getWriter } from "./formats";

export const convertCommand = new Command("convert")
    .description("Convert a token file to DTCG JSON, HRDT YAML, or CSS.")
    .argument("<file>", "Path to a token file")
    .option("-i, --inform [format]", "Input format: dtcg, hrdt (default: auto-detect)")
    .option("-f, --outform [format]", "Output format: dtcg, hrdt, css (default: css)")
    .option("-o, --out [file]", "Output file (default: stdout)")
    .action(async (file: string, options: { inform?: string; outform?: string; out?: string }) => {
        try {
            const reader = getReader(options.inform);

            const content = await new Source(file).getContent();
            const doc = reader.read(content);

            const writer = getWriter(options.outform);
            const output = writer.write(doc);

            if (options.out) {
                await writeFile(options.out, output);
            } else {
                process.stdout.write(output);
            }
        } catch (error) {
            console.error("Conversion failed:", (error as Error).message);
            process.exit(1);
        }
    });
