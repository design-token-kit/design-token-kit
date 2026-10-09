import type { TokenFormat } from "#/core/formats/TokenFormat";
import type { TokenReader } from "#/core/formats/TokenReader";
import type { TokenWriter } from "#/core/formats/TokenWriter";

/**
 * The declaration of one token format: how to recognise it, read it and write
 * it.
 *
 * Implement this to add a format, then register it in {@code tokenFormats}.
 * That is the whole of it - a descriptor is the single place a format is
 * declared, rather than parser maps, validator maps, detector branches and
 * build scripts to edit one by one.
 */
export interface FormatDescriptor {
    /** The format this descriptor declares. */
    readonly format: TokenFormat;

    /**
     * Name endings that identify this format, lowercase and dot-prefixed, e.g.
     * {@code [".dtcg.json", ".json"]}.
     *
     * Both forms are listed: the bare extension, and a qualified form naming
     * the format for when one extension serves several formats. The longest
     * match wins, so a qualified form is never shadowed by a bare one.
     *
     * Used as a hint when the content alone is ambiguous, and to tell the
     * format segment of a file name from the theme segment. May be empty when
     * the format has no distinctive ending.
     */
    readonly suffixes: readonly string[];

    /**
     * Returns true when the content looks like this format.
     *
     * Called in registration order, so a format that accepts almost anything
     * must be registered last.
     */
    detect(content: string): boolean;

    /**
     * Creates a reader for this format, loading its schema.
     *
     * Asynchronous because a schema is read from disk here, once per reader,
     * so that reading a document is synchronous afterwards.
     *
     * @param options - Format options; ignored by formats that take none.
     */
    createReader(options?: FormatOptions): Promise<TokenReader>;

    /**
     * Creates a writer for this format.
     */
    createWriter(): TokenWriter;
}

/**
 * Options a format may accept when its reader is created.
 */
export interface FormatOptions {
    /**
     * JSON Schema to validate against, when the format supports more than one.
     * Either a built-in schema name or a path to a directory holding schema
     * files. Formats bound to a single schema ignore it.
     */
    readonly schema?: string;
}
