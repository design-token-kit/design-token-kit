import type { CheckIssue } from "#/core/check/CheckIssue";

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
    validate(sources: string[]): Promise<CheckIssue[]>;
}
