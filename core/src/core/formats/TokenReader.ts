import type { Dtcg } from "#/core/model/Dtcg";
import type { CheckIssue } from "#/core/check/CheckIssue";

/**
 * Reads one token format into the {@link Dtcg} model.
 *
 * A reader owns its format end to end: it parses the syntax, validates what it
 * parsed - against its JSON Schema where it has one - and only then builds the
 * model. Diagnostics are returned rather than thrown, so a single read reports
 * every problem it found instead of stopping at the first one.
 */
export interface TokenReader {
    /**
     * Reads token source content.
     *
     * Synchronous: a reader is handed a schema that is already loaded, so
     * nothing here touches the file system. Reading a schema from disk happens
     * once, when {@link FormatDescriptor.createReader} builds the reader.
     *
     * @param content - The token document to read, as text in this reader's
     *   format: JSON for DTCG, YAML for HRDT, markdown for DESIGN.md.
     * @param sourceId - Names the content in diagnostics and on the resulting
     *   documents: a file path from the CLI, but equally a theme name or
     *   {@code "browser-input"} for content that was never on disk. An
     *   identifier, not a source to read from - a reader is handed the text
     *   and never fetches it, which is what lets the browser and the Figma
     *   plugin use the same readers.
     */
    read(content: string, sourceId?: string): ReadResult;
}

/**
 * Outcome of reading one token source: the documents, or why they could not be
 * read.
 *
 * A tagged union rather than one type carrying both: the compiler then refuses
 * to read `documents` until `ok` has been checked, where a single type
 * would let that slip through to a runtime failure.
 *
 * There is no partial outcome. A source that failed yields no documents at all
 * rather than incomplete ones, because a model missing its broken tokens would
 * make every reference to them look unresolved.
 *
 * Errors stop a read, so they appear on the failing branch alone. Warnings do
 * not: a source may express something the model cannot hold and still be
 * usable, so the successful branch carries them too.
 */
export type ReadResult = ReadSuccess | ReadFailure;

/**
 * A read that produced token documents.
 */
export interface ReadSuccess {
    readonly ok: true;

    /** The documents read. */
    readonly documents: Dtcg[];

    /**
     * Warnings about what the source expresses but the model cannot hold -
     * empty unless the format has something to report.
     */
    readonly issues: CheckIssue[];
}

/**
 * A read that produced no documents, and the diagnostics saying why.
 */
export interface ReadFailure {
    readonly ok: false;

    /** Why the source could not be read; never empty. */
    readonly issues: CheckIssue[];
}

/**
 * A read that produced documents.
 *
 * @param issues - Warnings worth reporting that did not stop the read.
 */
export function readDocuments(documents: Dtcg[], issues: CheckIssue[] = []): ReadSuccess {
    return { ok: true, documents, issues };
}

/**
 * A read that produced nothing, and the diagnostics saying why.
 */
export function readFailed(issues: CheckIssue[]): ReadFailure {
    return { ok: false, issues };
}
