/**
 * Where something sits in the source text.
 */
export interface SourcePosition {
    readonly line: number;
    readonly column: number;
}

/**
 * Finds where a value sits in the source text.
 *
 * A format implements this when its parser keeps positions; a format that
 * cannot report them is read without a locator, and its diagnostics carry the
 * token path alone.
 */
export interface SourceLocator {
    /** Position of the value at the path, when it can be located. */
    of(path: readonly string[]): SourcePosition | undefined;
}
