import { Source } from "#/core/io/Source";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { tokenFormats } from "#/core/formats/tokenFormats";
import { TokenFileName } from "#/core/formats/TokenFileName";
import type { Dtcg } from "#/core/model/Dtcg";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { ReadResult, TokenReader } from "#/core/formats/TokenReader";

/**
 * Loads token sources into a {@link DtcgList}.
 *
 * The first document is the base token set, subsequent documents are theme
 * overrides.
 *
 * Sources in different formats may be mixed: each source is read by the format
 * it is detected as.
 */
export class DtcgListLoader {
    readonly #schema?: string;

    /**
     * @param schema - DTCG JSON Schema, one of:
     *   - a directory path holding schema files
     *   - a built-in schema name:
     *     - "2025.10": stock DTCG 2025.10
     *     - "2025.10-design.md": "2025.10" extended with the "em" dimension
     *       unit for DESIGN.md
     *
     *   Defaults to the built-in "2025.10" schema.
     */
    constructor(schema?: string) {
        this.#schema = schema;
    }

    /**
     * Reads all sources into a {@link DtcgList}.
     *
     * Every source is read, so the diagnostics cover all of them rather than
     * stopping at the first that fails.
     *
     * @param sources - Paths to token files or {@code "-"} for stdin.
     * @param forcedFormat - When set, all sources are treated as this
     *   format instead of auto-detecting from content.
     */
    async read(sources: string[], forcedFormat?: TokenFormat): Promise<LoadResult> {
        const issues: CheckIssue[] = [];
        const documents: Array<{ source: string; doc: Dtcg }> = [];
        // One reader per format, so a run over many files reads each schema
        // once rather than once per file.
        const readers = new Map<TokenFormat, TokenReader>();

        for (const input of sources) {
            const source = new Source(input);
            const format = forcedFormat !== undefined
                ? tokenFormats.get(forcedFormat)
                : await source.getFormat();
            let reader = readers.get(format.format);
            if (reader === undefined) {
                reader = await format.createReader({ schema: this.#schema });
                readers.set(format.format, reader);
            }

            const result = reader.read(await source.getContent(), source.getInput());
            issues.push(...result.issues);
            if (result.ok) {
                documents.push(...result.documents.map((doc) => ({ source: source.getInput(), doc })));
            }
        }

        if (issues.some((issue) => issue.severity === "error")) {
            return loadFailed(issues);
        }
        return loadedList(this.#buildDtcgList(documents), issues);
    }

    /**
     * Reads all sources into a {@link DtcgList}, failing loudly.
     *
     * @throws TokenSyntaxError when any source cannot be read.
     */
    async load(sources: string[], forcedFormat?: TokenFormat): Promise<DtcgList> {
        const result = await this.read(sources, forcedFormat);
        if (!result.ok) {
            throw new TokenSyntaxError(result.issues);
        }
        return result.list;
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
 * Outcome of loading token sources: the assembled list, or why it could not be
 * assembled.
 *
 * Shaped like {@link ReadResult}, for the same reason: the compiler refuses to
 * read `list` until `ok` has been checked.
 *
 * Failing sources yield no list at all - one assembled from only the readable
 * sources would silently lose tokens. Warnings do not fail a load, so they
 * ride along with the successful branch.
 */
export type LoadResult = LoadSuccess | LoadFailure;

/**
 * A load that produced the assembled list.
 */
export interface LoadSuccess {
    readonly ok: true;

    /** The assembled list: a base document plus theme overrides. */
    readonly list: DtcgList;

    /**
     * Warnings the sources raised without stopping the load - empty unless a
     * format had something to report.
     */
    readonly issues: CheckIssue[];
}

/**
 * A load that produced no list, and the diagnostics saying why.
 */
export interface LoadFailure {
    readonly ok: false;

    /** Why the sources could not be loaded; never empty. */
    readonly issues: CheckIssue[];
}

/**
 * A load that produced the assembled list.
 */
export function loadedList(list: DtcgList, issues: CheckIssue[] = []): LoadSuccess {
    return { ok: true, list, issues };
}

/**
 * A load that produced nothing, and the diagnostics saying why.
 */
export function loadFailed(issues: CheckIssue[]): LoadFailure {
    return { ok: false, issues };
}

/**
 * Thrown by {@link DtcgListLoader.load} when a source cannot be read.
 *
 * The {@link issues} field carries the diagnostics explaining why.
 */
export class TokenSyntaxError extends Error {
    readonly issues: CheckIssue[];

    constructor(issues: CheckIssue[]) {
        // The diagnostics go into the message, not just the field: a handler
        // that only prints `error.message` - which is what a CLI does - would
        // otherwise report that something failed without saying what.
        super(formatIssues(issues));
        this.name = "TokenSyntaxError";
        this.issues = issues;
    }

    formatIssues(): string {
        return formatIssues(this.issues);
    }
}

/**
 * Names the theme a source overrides.
 *
 * The name is read as `<role>[.theme].<format>`; a source carrying no theme -
 * a base document listed after the first - is named by its role, so several
 * such sources stay apart.
 *
 * Stdin has no name to read, so it is numbered by position.
 */
function extractThemeName(source: string, index: number): string {
    if (source === "-") {
        return `stdin-${index + 1}`;
    }

    const name = TokenFileName.parse(source, tokenFormats);
    return name.theme ?? name.role;
}

/**
 * Renders diagnostics as one message, a line per issue.
 */
function formatIssues(issues: CheckIssue[]): string {
    return issues
        .map((issue) => `[${issue.id}] ${issue.sourcePath} - ${issue.message}`)
        .join("\n");
}
