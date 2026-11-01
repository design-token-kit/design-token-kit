import type { SrgbColor } from "#/core/audit/color/SrgbColor";
import type { TokenPath } from "#/core/model/TokenPath";

/**
 * A piece of text to audit for accessibility and readability, independent of
 * where it comes from.
 *
 * Token files yield two kinds of samples: a foreground and a background color
 * token that are meant to be used together, and a typography token. A Figma
 * text node yields a single sample with both its colors and its typography.
 * Each rule reads only the fields it needs and skips samples that lack them.
 */
export interface TextSample {
    /** Stable identifier: the token paths or the Figma node id the sample was built from. */
    readonly id: string;

    /** What the sample is, as shown to the user, e.g. `text-primary on background-canvas`. */
    readonly label: string;

    /** Path to the source file. */
    readonly sourcePath?: string;

    /** Path to the token the sample was built from, or its foreground token. */
    readonly tokenPath?: TokenPath;

    /** Theme the sample belongs to; `undefined` for the base token set. */
    readonly theme?: string;

    /** Text color. */
    readonly foreground?: SrgbColor;

    /** Color behind the text. */
    readonly background?: SrgbColor;

    /**
     * Why the text or background color could not be read, for a sample that
     * is meant to have both but lacks one.
     */
    readonly colorProblem?: string;

    /** Font size in px. */
    readonly fontSizePx?: number;

    /** Numeric font weight, from 1 to 1000. */
    readonly fontWeight?: number;

    /** Line height as a unitless multiplier of the font size. */
    readonly lineHeight?: number;
}
