import { linearizeSrgbChannel, type SrgbColor } from "#/core/audit/color/SrgbColor";

/**
 * WCAG conformance level for text contrast.
 *
 * @see https://www.w3.org/TR/WCAG22/#contrast-minimum
 * @see https://www.w3.org/TR/WCAG22/#contrast-enhanced
 */
export type WcagLevel = "AA" | "AAA";

/** All WCAG levels, from the least to the most demanding. */
export const WCAG_LEVELS: readonly WcagLevel[] = ["AA", "AAA"];

/** Smallest font size, in px, that counts as large text at any weight (18pt). */
export const LARGE_TEXT_SIZE_PX = 24;

/** Smallest font size, in px, that counts as large text when bold (14pt). */
export const LARGE_BOLD_TEXT_SIZE_PX = 18.66;

/** Lowest font weight that counts as bold for the large text rule. */
export const BOLD_FONT_WEIGHT = 700;

const MINIMUM_CONTRAST: Record<WcagLevel, { normal: number; large: number }> = {
    AA: { normal: 4.5, large: 3 },
    AAA: { normal: 7, large: 4.5 },
};

/**
 * Returns the WCAG relative luminance of an opaque sRGB color, from 0 (black)
 * to 1 (white).
 *
 * @see https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */
export function relativeLuminance(color: SrgbColor): number {
    return 0.2126 * linearizeSrgbChannel(color.red)
        + 0.7152 * linearizeSrgbChannel(color.green)
        + 0.0722 * linearizeSrgbChannel(color.blue);
}

/**
 * Returns the WCAG contrast ratio of two opaque colors, from 1 to 21.
 *
 * The order of the colors does not matter. Translucent colors must be
 * composited with {@link compositeOver} first.
 *
 * @see https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */
export function contrastRatio(first: SrgbColor, second: SrgbColor): number {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Paints a color over a backdrop with source-over alpha compositing, the way a
 * browser or Figma renders a translucent fill.
 */
export function compositeOver(color: SrgbColor, backdrop: SrgbColor): SrgbColor {
    const alpha = color.alpha + backdrop.alpha * (1 - color.alpha);
    if (alpha === 0) {
        return { red: 0, green: 0, blue: 0, alpha: 0 };
    }
    const channel = (top: number, bottom: number): number =>
        (top * color.alpha + bottom * backdrop.alpha * (1 - color.alpha)) / alpha;
    return {
        red: channel(color.red, backdrop.red),
        green: channel(color.green, backdrop.green),
        blue: channel(color.blue, backdrop.blue),
        alpha,
    };
}

/**
 * Returns whether text of this size and weight counts as large text, which
 * needs less contrast.
 *
 * Text of unknown size is treated as normal text, the stricter case.
 *
 * @see https://www.w3.org/TR/WCAG22/#dfn-large-scale
 */
export function isLargeText(fontSizePx: number | undefined, fontWeight: number | undefined): boolean {
    if (fontSizePx === undefined) return false;
    if (fontSizePx >= LARGE_TEXT_SIZE_PX) return true;
    return fontSizePx >= LARGE_BOLD_TEXT_SIZE_PX && (fontWeight ?? 0) >= BOLD_FONT_WEIGHT;
}

/**
 * Returns the minimum contrast ratio WCAG requires for text at a level.
 */
export function minimumContrast(level: WcagLevel, largeText: boolean): number {
    const thresholds = MINIMUM_CONTRAST[level];
    return largeText ? thresholds.large : thresholds.normal;
}

/**
 * Formats a contrast ratio for display, e.g. `4.49:1`.
 *
 * The ratio is truncated rather than rounded: WCAG compares the exact value, so
 * a ratio of 4.499 fails a 4.5 threshold and must not be shown as `4.50:1`.
 */
export function formatContrastRatio(ratio: number): string {
    return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}
