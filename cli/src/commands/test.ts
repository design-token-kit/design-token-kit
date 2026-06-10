import { Command } from "commander";
import { Source } from "@design-token-kit/core";
import { getDetectedReader, getRoundTripWriter } from "./formats";

export const testCommand = new Command("test")
    .description("Load a DTCG JSON or HRDT YAML file, build the model, and print it back (round-trip check).")
    .argument("<file>", "Path to a DTCG JSON or HRDT file")
    .option("-f, --outform <format>", "Output format: dtcg, hrdt (default: same as input)")
    .action(async (file: string, options: { outform?: string }) => {
        try {
            const reader = getDetectedReader(file);
            const writer = getRoundTripWriter(options.outform, file);
            const content = await new Source(file).getContent();
            const doc = reader.read(content);
            process.stdout.write(writer.write(doc));
        } catch (error) {
            console.error(`Error: ${(error as Error).message}`);
            process.exit(1);
        }
    });
