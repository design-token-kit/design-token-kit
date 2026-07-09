import { Command } from "commander";
import { DtcgChecker, DtcgList, DtcgListLoader, DtcgTailwindCssConverter, DtcgTokenCssConverter, DtcgTokenScssConverter, Format, type TokenScssOutput } from "@design-token-kit/core";
import { writeFile } from "node:fs/promises";
import { dirname, extname, join, parse } from "node:path";
import { getWriter, toDocumentFormat } from "./formats";
import { hasErrors, printIssues } from "./issues";

const EXIT_FAILURE = 1;

type ConvertOptions = {
    outform?: string;
    out?: string;
    inform?: string;
    separator?: string;
    baseSelector?: string;
    themeSelector?: string;
};

export const convertCommand = new Command("convert")
    .description("Convert a token file to DTCG JSON, HRDT YAML, DESIGN.md, CSS, SCSS, or Tailwind CSS v4 theme CSS.")
    .argument("[files...]", "Paths to token files (reads from stdin when omitted or '-')")
    .option("-i, --inform [format]", "Input format: dtcg, hrdt, design-md (default: auto-detect)")
    .option("-f, --outform [format]", "Output format: dtcg, hrdt, design-md, css, scss, tailwind-v4 (default: css)")
    .option("--separator [value]", "SCSS only: character used to replace '.' in token paths when generating variable names (default: -)")
    .option("--base-selector [selector]", "Tailwind v4 only: selector for mirrored base custom properties (default: :root)")
    .option("--theme-selector [template]", "Tailwind v4 only: selector template for theme overrides with {theme} placeholder")
    .option("-o, --out [file]", "Output file (SCSS multi-theme: omit for tar stdout, use .tar for archive, or .scss for per-theme files)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  conversion failed")
    .action(async (files: string[], options: ConvertOptions) => {
        try {
            const outform = options.outform ?? Format.CSS;
            const forcedFormat = options.inform !== undefined
                ? toDocumentFormat(options.inform)
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
            if (outform === Format.SCSS && list.themes.size > 0) {
                const outputs = new DtcgTokenScssConverter({
                    separator: options.separator,
                }).convertThemeList(list);

                if (!options.out) {
                    process.stdout.write(createScssThemeArchive(outputs, "tokens"));
                    return;
                }

                if (extname(options.out).toLowerCase() === ".tar") {
                    await writeFile(options.out, createScssThemeArchive(outputs, toArchiveBaseName(options.out)));
                    return;
                }

                await writeScssThemeOutputs(outputs, options.out);
                return;
            }

            const output = convertList(list, outform, options);
            await writeOutput(output, options.out);
        } catch (error) {
            console.error("Conversion failed:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

async function loadSources(files: string[], forcedFormat?: Format): Promise<DtcgList> {
    const sources = files.length > 0 ? files : ["-"];
    return new DtcgListLoader().load(sources, forcedFormat);
}

function convertList(list: DtcgList, outform: string, options: ConvertOptions): string {
    if (outform === Format.CSS) {
        return new DtcgTokenCssConverter().convertList(list);
    }
    if (outform === Format.SCSS) {
        return new DtcgTokenScssConverter({
            separator: options.separator,
        }).convertList(list);
    }
    if (outform === Format.TAILWIND_V4) {
        return new DtcgTailwindCssConverter({
            baseSelector: options.baseSelector,
            themeSelector: options.themeSelector,
        }).convertList(list);
    }
    if (list.themes.size > 0) {
        throw new Error(`Multiple files are only supported with --outform css or tailwind-v4, got ${outform}`);
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

async function writeScssThemeOutputs(outputs: ReadonlyArray<TokenScssOutput>, out: string): Promise<void> {
    const filePaths = toScssThemeOutputPaths(outputs, out);
    await Promise.all(filePaths.map(({ filePath, content }) => writeFile(filePath, content)));
}

function createScssThemeArchive(outputs: ReadonlyArray<TokenScssOutput>, baseName: string): Buffer {
    return createTarArchive(
        outputs.map((output) => ({
            name: `${baseName}.${output.themeName}.scss`,
            content: Buffer.from(output.content, "utf8"),
        })),
    );
}

function toScssThemeOutputPaths(outputs: ReadonlyArray<TokenScssOutput>, out: string): Array<{ filePath: string; content: string }> {
    const parsed = parse(out);
    const outputDir = parsed.dir || dirname(out);
    const ext = extname(out).toLowerCase();
    const baseName = ext === ".scss"
        ? parsed.name
        : parsed.base || parsed.name;

    if (!baseName) {
        throw new Error(`Cannot derive SCSS output file names from "${out}"`);
    }

    return outputs.map((output) => ({
        filePath: join(outputDir, `${baseName}.${output.themeName}.scss`),
        content: output.content,
    }));
}

function toArchiveBaseName(out: string): string {
    const parsed = parse(out);
    if (extname(out).toLowerCase() !== ".tar") {
        return parsed.base || parsed.name || "tokens";
    }
    return parsed.name || "tokens";
}

function createTarArchive(files: Array<{ name: string; content: Buffer }>): Buffer {
    const chunks: Buffer[] = [];

    for (const file of files) {
        chunks.push(createTarHeader(file.name, file.content.length));
        chunks.push(file.content);

        const remainder = file.content.length % 512;
        if (remainder !== 0) {
            chunks.push(Buffer.alloc(512 - remainder));
        }
    }

    chunks.push(Buffer.alloc(1024));
    return Buffer.concat(chunks);
}

function createTarHeader(name: string, size: number): Buffer {
    const header = Buffer.alloc(512);

    writeTarString(header, 0, 100, name);
    writeTarOctal(header, 100, 8, 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, size);
    writeTarOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeTarString(header, 257, 6, "ustar");
    writeTarString(header, 263, 2, "00");

    const checksum = header.reduce((sum, value) => sum + value, 0);
    const checksumField = `${checksum.toString(8).padStart(6, "0")}\0 `;
    writeTarString(header, 148, 8, checksumField);

    return header;
}

function writeTarString(target: Buffer, offset: number, length: number, value: string): void {
    target.write(value.slice(0, length), offset, Math.min(length, Buffer.byteLength(value)), "utf8");
}

function writeTarOctal(target: Buffer, offset: number, length: number, value: number): void {
    const encoded = value.toString(8).padStart(length - 1, "0");
    writeTarString(target, offset, length, `${encoded}\0`);
}
