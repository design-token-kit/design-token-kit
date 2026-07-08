import type { TokenScssOutput } from "#/core/platforms/scss/TokenScssOutput";

/**
 * Converter for design tokens to SCSS variables.
 *
 * @remarks
 * Implementations convert DTCG token sources into SCSS variable declarations.
 * Single-document output can be returned as one stylesheet, while multi-theme
 * output is exposed as separate per-theme stylesheets.
 */
export interface TokenScssConverter {
    /**
     * Converts token files to SCSS variables.
     *
     * @param sources - Array of paths to token files in supported token formats
     * @returns Generated SCSS stylesheet
     * @throws Error if conversion failed
     */
    convert(sources: string[]): Promise<string>;

    /**
     * Converts token files to one SCSS stylesheet per theme.
     *
     * @param sources - Array of paths to token files in supported token formats
     * @returns Generated SCSS stylesheets grouped by theme
     * @throws Error if conversion failed
     */
    convertThemes(sources: string[]): Promise<ReadonlyArray<TokenScssOutput>>;
}
