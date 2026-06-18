/**
 * Design tokens statistics service.
 *
 * @remarks
 * Analyzes token files and returns a formatted statistics report.
 * The report includes counts of total tokens, groups, and per-theme breakdowns.
 */
export interface TokenStats {
    /**
     * Analyzes token sources and returns a formatted report.
     *
     * @param sources - Array of paths to token files in DTCG JSON or HRDT YAML format.
     * @returns Formatted statistics report string.
     */
    stats(sources: string[]): Promise<string>;
}
