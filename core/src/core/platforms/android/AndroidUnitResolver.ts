import type { AndroidDimensionUnit } from "#/core/platforms/android/AndroidDimensionValueConverter";

/**
 * Path segments marking a token as font-related, matched case-insensitively
 * against normalized name parts.
 */
const FONT_SEGMENTS = new Set(["font", "fonts", "text", "typography", "type"]);

/**
 * Name parts that only mark a font-related token when combined with a size
 * meaning, e.g. `font.size` but not `font.family`.
 */
const SIZE_SEGMENTS = new Set(["size", "sizes", "fontsize", "linesize"]);

/**
 * Decides which Android unit a dimension token is emitted in.
 *
 * @remarks
 * Android renders font sizes in `sp` so they follow the user's font scale, and
 * every other size in `dp`. DTCG has a single `dimension` type, so the unit is
 * inferred from the token position: font sizes inside a `typography` composite
 * are always `sp`, and standalone tokens are `sp` when their path denotes a
 * font size, e.g. `font.size.md`.
 */
export class AndroidUnitResolver {
    /**
     * Resolves the unit for a standalone dimension token.
     *
     * @param path - Token path segments, normalized to lower-case name parts.
     * @returns `sp` for font size tokens, `dp` otherwise.
     */
    resolve(path: readonly string[]): AndroidDimensionUnit {
        return this.#isFontSize(path) ? "sp" : "dp";
    }

    #isFontSize(path: readonly string[]): boolean {
        return path.some((segment) => FONT_SEGMENTS.has(segment))
            && path.some((segment) => SIZE_SEGMENTS.has(segment));
    }
}
