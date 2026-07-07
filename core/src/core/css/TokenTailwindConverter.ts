/**
 * Converter for design tokens to Tailwind CSS v4 theme CSS.
 *
 * @remarks
 * Implementations convert DTCG token sources into Tailwind CSS v4 output
 * with an {@code @theme} block for base tokens and plain CSS overrides for
 * additional themes.
 */
export interface TokenTailwindConverter {
    /**
     * Converts token files to Tailwind CSS v4 theme output.
     *
     * @param sources - Array of paths to token files in supported token formats
     * @returns Generated Tailwind CSS v4 theme stylesheet
     * @throws Error if conversion failed
     */
    convert(sources: string[]): Promise<string>;
}
