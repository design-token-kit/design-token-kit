import { TokenReference } from "#/core/model/TokenReference";
import { FontWeightName } from "#/core/model/values/FontWeightName";
import { FontFamilyValue, FontWeightValue } from "#/core/model/values/TypographyValue";

/**
 * Formats a token reference the way the calling output writes references,
 * such as a CSS `var()` or an SCSS variable.
 */
export type CssReferenceFormatter = (reference: TokenReference) => string;

/**
 * Font weight names that CSS accepts as keywords.
 *
 * @see https://www.w3.org/TR/css-fonts-4/#font-weight-absolute-values
 */
const CSS_FONT_WEIGHT_KEYWORDS: ReadonlySet<FontWeightName> = new Set([FontWeightName.NORMAL, FontWeightName.BOLD]);

/**
 * Generic font families, which CSS reads as generic families only when
 * unquoted: the complete, incomplete and script-specific ones.
 *
 * @see https://www.w3.org/TR/css-fonts-4/#generic-font-families
 */
const CSS_GENERIC_FONT_FAMILIES: ReadonlySet<string> = new Set([
    "serif",
    "sans-serif",
    "system-ui",
    "cursive",
    "fantasy",
    "math",
    "monospace",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "generic(fangsong)",
    "generic(kai)",
    "generic(khmer-mul)",
    "generic(nastaliq)",
]);

/**
 * Writes a font weight as a CSS `<font-weight-absolute>` value.
 *
 * A number is written as is.
 * The names `normal` and `bold` are valid CSS keywords and are kept.
 * Every other DTCG name is invalid in CSS and is written as its number.
 *
 * @param value - A numeric font weight or a DTCG font weight name.
 * @see https://www.w3.org/TR/css-fonts-4/#font-weight-prop
 * @see https://www.w3.org/TR/css-fonts-4/#font-weight-absolute-values
 */
export function fontWeightToCss(value: FontWeightValue): string {
    if (typeof value === "number") return String(value);
    return CSS_FONT_WEIGHT_KEYWORDS.has(value) ? value.name : String(value.weight);
}

/**
 * Writes a font family as a CSS `font-family` value.
 *
 * Generic families are written without quotes, because a quoted generic
 * family names a font rather than the generic family.
 * Every other family name is quoted.
 * References are written by the caller's formatter.
 *
 * @param family - A single family name or a list of names and references.
 * @param formatReference - Writes a reference inside the list.
 * @see https://www.w3.org/TR/css-fonts-4/#font-family-prop
 * @see https://www.w3.org/TR/css-fonts-4/#generic-font-families
 */
export function fontFamilyToCss(family: FontFamilyValue, formatReference: CssReferenceFormatter): string {
    const entries: ReadonlyArray<string | TokenReference> = typeof family === "string" ? [family] : family;
    return entries
        .map((entry) => entry instanceof TokenReference ? formatReference(entry) : familyNameToCss(entry))
        .join(", ");
}

/**
 * Writes a font family token value as a CSS `font-family` value, or nothing
 * for an empty family list.
 *
 * An empty list has no CSS value, so the caller skips its declaration.
 *
 * @param family - A single family name or a list of names and references.
 * @param formatReference - Writes a reference inside the list.
 * @returns The CSS value, or `undefined` for an empty list.
 */
export function fontFamilyTokenToCss(
    family: FontFamilyValue,
    formatReference: CssReferenceFormatter,
): string | undefined {
    const empty: boolean = Array.isArray(family) && family.length === 0;
    return empty ? undefined : fontFamilyToCss(family, formatReference);
}

function familyNameToCss(name: string): string {
    return CSS_GENERIC_FONT_FAMILIES.has(name) ? name : `"${name}"`;
}
