/**
 * One generated SCSS stylesheet output.
 */
export interface TokenScssOutput {
    /**
     * Theme name associated with the stylesheet.
     *
     * Base document output always uses {@code "base"}.
     */
    readonly themeName: string;

    /**
     * Whether this stylesheet was generated from the base token document.
     */
    readonly isBase: boolean;

    /**
     * Generated SCSS content for the theme.
     */
    readonly content: string;
}
