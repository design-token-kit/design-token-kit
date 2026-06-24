import { Command } from "commander";
import { DtcgChecker, DtcgList, DtcgListLoader, DtcgTokenCssConverter, Format as CoreFormat } from "@design-token-kit/core";
import { writeFile } from "node:fs/promises";
import { Format, getWriter, toDocumentFormat } from "./formats";
import { hasErrors, printIssues } from "./issues";

const EXIT_FAILURE = 1;

type ConvertOptions = {
    outform?: string;
    out?: string;
    inform?: string;
};

export const convertCommand = new Command("convert")
    .description("Convert a token file to DTCG JSON, HRDT YAML, DESIGN.md, or CSS.")
    .argument("[files...]", "Paths to token files (reads from stdin when omitted or '-')")
    .option("-i, --inform [format]", "Input format: dtcg, hrdt, design-md (force all files to this format)")
    .option("-f, --outform [format]", "Output format: dtcg, hrdt, design-md, css (default: css)")
    .option("-o, --out [file]", "Output file (default: stdout)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  conversion failed")
    .action(async (files: string[], options: ConvertOptions) => {
        try {
            const outform = options.outform ?? Format.CSS;
            const forcedFormat = options.inform !== undefined
                ? toDocumentFormat(options.inform) as unknown as CoreFormat
                : undefined;
            if (forcedFormat === undefined) {
                const sources = files.length > 0 ? files : ["-"];
                const issues = await new DtcgChecker().validate(sources);
                printIssues(issues);
                if (hasErrors(issues)) {
                    throw new Error("Token validation failed");
                }
            }
            const list: DtcgList = await loadSources(files, forcedFormat);
            const output = convertList(list, outform);
            await writeOutput(output, options.out);
        } catch (error) {
            console.error("Conversion failed:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

async function loadSources(files: string[], forcedFormat?: CoreFormat): Promise<DtcgList> {
    const sources = files.length > 0 ? files : ["-"];
    return new DtcgListLoader().load(sources, forcedFormat);
}

function convertList(list: DtcgList, outform: string): string {
    if (outform === Format.CSS) {
        return new DtcgTokenCssConverter().convertList(list);
    }
    if (list.themes.size > 0) {
        throw new Error(`Multiple files are only supported with --outform css, got ${outform}`);
    }
    return getWriter(outform).write(list.base);
}

async function writeOutput(output: string, out?: string): Promise<void> {
    if (out) {
        await writeFile(out, output);
    } else {
        process.stdout.write(output);
    }
}
