/**
 * Converter for design tokens to CSS.
 *
 * @remarks
 * Each converter implements its own engine for turning DTCG tokens
 * into CSS custom properties. Input is an array of paths to JSON token files,
 * output is a CSS string or error.
 */
export interface TokenCssConverter {
    /**
     * Converts token files to CSS.
     *
     * @param sources - Array of paths to token files in DTCG JSON format
     * @returns Generated CSS
     * @throws Error if conversion failed
     */
    convert(sources: string[]): Promise<string>;
}
