/**
 * HTML showcase for design tokens.
 *
 * @remarks
 * Each implementation provides its own engine for building the HTML showcase:
 * - from DTCG JSON tokens using validate -> convert -> render chain;
 * - from ready CSS (for a single source) using direct render.
 * Input is an array of source file paths, output is an HTML string or error.
 */
export interface TokenHtmlShowcase {
    /**
     * Builds an HTML page from token files.
     *
     * @param sources - Array of paths to source files
     * @returns HTML string of the showcase
     * @throws Error if building the showcase failed
     */
    showcase(sources: string[]): Promise<string>;
}
