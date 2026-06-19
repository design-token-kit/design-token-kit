/**
 * Design tokens statistics service.
 *
 * @remarks
 * Analyzes token files and returns a formatted statistics report.
 * The report includes counts of total tokens, groups, and per-theme breakdowns.
 */
export interface TokenStats {
    stats(sources: string[]): Promise<string>;
}
