import { Source } from "#/core/io/Source";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import { Format } from "#/core/io/Format";
import { HrdtTokenReader } from "#/core/io/HrdtTokenReader";
import { DtcgSchemaValidator } from "#/core/validation/dtcg/DtcgSchemaValidator";
import { HrdtTokenValidator } from "#/core/validation/hrdt/HrdtTokenValidator";
import type { Dtcg } from "#/core/model/Dtcg";
import type { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";

/**
 * Loads and validates token sources, assembling a {@link DtcgList}.
 *
 * The first document is the base token set, subsequent documents are theme
 * overrides.
 *
 * Sources in different formats may be mixed.
 */
export class DtcgListLoader {

    readonly #validators = new Map<Format, TokenValidator>([
        [Format.HRDT, new HrdtTokenValidator()],
        [Format.DTCG, new DtcgSchemaValidator()],
    ]);

    readonly #parsers = new Map<Format, (source: Source) => Promise<Dtcg[]>>([
        [Format.HRDT, async (source) => new HrdtTokenReader().parseAll(await source.getContent(), source.getInput())],
        [Format.DTCG, async (source) => [new DtcgJsonReader().parse(await source.getContent(), source.getInput())]],
    ]);

    /**
     * Validates and loads all sources into a {@link DtcgList}.
     *
     * @param sources - Paths to token files or {@code "-"} for stdin.
     * @param forcedFormat - When set, all sources are treated as this
     *   format instead of auto-detecting from content.
     * @throws TokenSyntaxError when schema validation fails.
     */
    async load(sources: string[], forcedFormat?: Format): Promise<DtcgList> {
        const sourceList = sources.map((s) => new Source(s));

        const issues = await this.#validate(sourceList, forcedFormat);
        if (issues.length > 0) {
            throw new TokenSyntaxError(issues);
        }

        const allDocs = await this.#parse(sourceList, forcedFormat);
        return this.#buildDtcgList(allDocs);
    }

    async #validate(sourceList: Source[], forcedFormat?: Format): Promise<CheckIssue[]> {
        const issues: CheckIssue[] = [];
        for (const source of sourceList) {
            const format = forcedFormat ?? await source.getFormat();
            const validator = this.#validators.get(format)!;
            issues.push(...await validator.validate([source.getInput()]));
        }
        return issues;
    }

    async #parse(sourceList: Source[], forcedFormat?: Format): Promise<Array<{ source: string; doc: Dtcg }>> {
        const allDocs = new Array<{ source: string; doc: Dtcg }>();
        for (const source of sourceList) {
            const format = forcedFormat ?? await source.getFormat();
            const parser = this.#parsers.get(format)!;
            for (const doc of await parser(source)) {
                allDocs.push({ source: source.getInput(), doc });
            }
        }
        return allDocs;
    }

    #buildDtcgList(allDocs: Array<{ source: string; doc: Dtcg }>): DtcgList {
        const [baseEntry, ...themeEntries] = allDocs;
        const themes = new Map(
            themeEntries.map((entry, i) => [
                extractThemeName(entry.source, i),
                entry.doc,
            ]),
        );
        return new DtcgList(baseEntry.doc, themes);
    }
}

/**
 * Thrown by {@link DtcgListLoader.load} when schema validation fails.
 *
 * The {@link issues} field contains individual validation diagnostics.
 */
export class TokenSyntaxError extends Error {
    readonly issues: CheckIssue[];

    constructor(issues: CheckIssue[]) {
        super("Schema validation failed");
        this.name = "TokenSyntaxError";
        this.issues = issues;
    }

    formatIssues(): string {
        return this.issues
            .map((i) => `[${i.id}] ${i.sourcePath} - ${i.message}`)
            .join("\n");
    }
}

function extractThemeName(source: string, index?: number): string {
    if (source === "-") {
        return index !== undefined ? `stdin-${index + 1}` : "stdin";
    }
    const fileName = source.split("/").at(-1)?.split("\\").at(-1) ?? source;
    const withoutExt = fileName.replace(/\.(json|ya?ml)$/i, "");
    const dotIndex = withoutExt.lastIndexOf(".");
    return dotIndex > 0 ? withoutExt.slice(dotIndex + 1) : withoutExt;
}
