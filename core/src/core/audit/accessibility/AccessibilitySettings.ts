import type { WcagLevel } from "#/core/audit/color/Wcag";

/**
 * Thresholds of the accessibility and readability rules.
 */
export interface AccessibilityOptions {
    /** WCAG level text contrast is audited against. Defaults to `"AA"`. */
    readonly level?: WcagLevel;

    /** Smallest readable font size in px. Defaults to 12. */
    readonly minFontSizePx?: number;

    /** Smallest line height of body text, as a multiplier of the font size. Defaults to 1.3. */
    readonly minBodyLineHeight?: number;

    /**
     * Font size in px from which text counts as a heading rather than body text,
     * so the body line height rule no longer applies. Defaults to 18.
     */
    readonly headingSizePx?: number;
}

/**
 * {@link AccessibilityOptions} with every default applied.
 */
export type AccessibilitySettings = Required<AccessibilityOptions>;

/**
 * Applies the defaults to the given options.
 */
export function toAccessibilitySettings(options: AccessibilityOptions = {}): AccessibilitySettings {
    return {
        level: options.level ?? "AA",
        minFontSizePx: options.minFontSizePx ?? 12,
        minBodyLineHeight: options.minBodyLineHeight ?? 1.3,
        headingSizePx: options.headingSizePx ?? 18,
    };
}
