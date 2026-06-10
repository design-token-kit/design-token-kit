/**
 * Severity level of a diagnostic.
 */
export type IssueSeverity = "error" | "warning";

/**
 * Design tokens validator.
 *
 * @remarks
 * Each validator puts its own check method for DTCG tokens.
 * Input is an array of token file paths, output is a collection of diagnostics.
 */
export interface TokenValidator {
    /**
     * Validates token files.
     *
     * @param sources - Array of paths to token files in DTCG JSON format
     * @returns Collection of validation diagnostics
     */
    validate(sources: string[]): Promise<ValidationIssue[]>;
}

/**
 * A single validation diagnostic from a validator.
 */
export interface ValidationIssue {
    /** Name of the validator that issued the diagnostic. */
    name: string;

    /** Path to the source file. */
    sourcePath: string;

    /** Message text. */
    message: string;

    /** Severity level. */
    severity: IssueSeverity;

    /** Line number (if available). */
    line?: number;

    /** Column number (if available). */
    column?: number;

    /** Raw data for debugging. */
    raw?: unknown;
}