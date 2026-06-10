import { TokenReference } from "#/core/model/TokenReference";
import { DimensionOrReference } from "#/core/model/values/DimensionValue";

/**
 * A font family is a single font name or an ordered list of font names,
 * from most to least preferred (matching CSS `font-family` fallback semantics).
 *
 * @see https://tr.designtokens.org/format/#font-family
 */
export type FontFamilyValue = string | (string | TokenReference)[];

/**
 * Pre-defined font weight keywords from the OpenType `wght` tag specification.
 *
 * @see https://tr.designtokens.org/format/#font-weight
 */
export type FontWeightKeyword =
    | "thin"
    | "hairline"
    | "extra-light"
    | "ultra-light"
    | "light"
    | "normal"
    | "regular"
    | "book"
    | "medium"
    | "semi-bold"
    | "demi-bold"
    | "bold"
    | "extra-bold"
    | "ultra-bold"
    | "black"
    | "heavy"
    | "extra-black"
    | "ultra-black";

/**
 * A font weight as a numeric value (1-1000) or a pre-defined keyword.
 *
 * @see https://tr.designtokens.org/format/#font-weight
 */
export type FontWeightValue = number | FontWeightKeyword;

/** A font family value or a reference to another fontFamily token. */
export type FontFamilyOrReference = FontFamilyValue | TokenReference;

/** A font weight value or a reference to another fontWeight token. */
export type FontWeightOrReference = FontWeightValue | TokenReference;

/**
 * Represents a complete typographic style.
 * `lineHeight` is a unitless multiplier of `fontSize`.
 *
 * @see https://tr.designtokens.org/format/#typography
 */
export class TypographyValue {
    readonly fontFamily: FontFamilyOrReference;
    readonly fontSize: DimensionOrReference;
    readonly fontWeight: FontWeightOrReference;
    readonly letterSpacing: DimensionOrReference;
    /** Unitless multiplier of fontSize. */
    readonly lineHeight: number | TokenReference;

    constructor(
        fontFamily: FontFamilyOrReference,
        fontSize: DimensionOrReference,
        fontWeight: FontWeightOrReference,
        letterSpacing: DimensionOrReference,
        lineHeight: number | TokenReference,
    ) {
        this.fontFamily = fontFamily;
        this.fontSize = fontSize;
        this.fontWeight = fontWeight;
        this.letterSpacing = letterSpacing;
        this.lineHeight = lineHeight;
    }
}

/** A typography value or a reference to another typography token. */
export type TypographyOrReference = TypographyValue | TokenReference;
