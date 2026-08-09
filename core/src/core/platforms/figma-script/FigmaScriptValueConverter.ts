import { TokenReference } from "#/core/model/TokenReference";
import type { ColorComponent, ColorValue } from "#/core/model/values/ColorValue";
import { ColorValue as ColorValueClass } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

/**
 * CSS root font size, used to express `rem` dimensions in pixels.
 *
 * Figma variables are unitless and interpreted as pixels, so a `rem` value has
 * to be resolved at conversion time.
 */
const REM_IN_PX = 16;

/**
 * Font style names Figma ships for each numeric weight.
 *
 * The Figma export path infers a numeric weight back from this name, so the
 * table has to stay aligned with it for a token set to survive a round trip.
 */
const FONT_STYLE_BY_WEIGHT = new Map<number, string>([
    [100, "Thin"],
    [200, "ExtraLight"],
    [300, "Light"],
    [400, "Regular"],
    [500, "Medium"],
    [600, "SemiBold"],
    [700, "Bold"],
    [800, "ExtraBold"],
    [900, "Black"],
]);

const FALLBACK_FONT_STYLE = "Regular";

/**
 * Font weight keywords mapped to the numeric scale.
 */
const WEIGHT_BY_KEYWORD: Record<string, number> = {
    "thin": 100,
    "hairline": 100,
    "extra-light": 200,
    "ultra-light": 200,
    "light": 300,
    "normal": 400,
    "regular": 400,
    "book": 400,
    "medium": 500,
    "semi-bold": 600,
    "demi-bold": 600,
    "bold": 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    "black": 900,
    "heavy": 900,
    "extra-black": 950,
    "ultra-black": 950,
};

/**
 * A Figma colour, with channels in the 0..1 range.
 */
export interface FigmaScriptColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

/**
 * Figma text style fields derived from a typography token.
 */
export interface FigmaScriptTypography {
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    letterSpacing: number;
    /**
     * Unitless multiplier; the runtime converts it to the percentage Figma stores.
     */
    lineHeight: number;
}

/**
 * One Figma shadow effect.
 */
export interface FigmaScriptShadow {
    type: "DROP_SHADOW" | "INNER_SHADOW";
    color: FigmaScriptColor;
    offset: { x: number; y: number };
    radius: number;
    spread: number;
}

/**
 * Converts DTCG token values to the plain data a Figma script carries.
 *
 * The converter produces data rather than source text: the emitted script keeps
 * its values in literals, so serialisation stays in one place.
 */
export class FigmaScriptValueConverter {

    /**
     * Converts a colour to Figma channels.
     *
     * Components outside sRGB are used as given: Figma has no wide-gamut
     * variables, so the caller reports the loss rather than the converter.
     */
    convertColor(color: ColorValue): FigmaScriptColor {
        const [r, g, b] = color.components;

        return {
            r: this.#channel(r),
            g: this.#channel(g),
            b: this.#channel(b),
            a: clamp(color.alpha),
        };
    }

    /**
     * Converts a dimension to a Figma float, resolving `rem` to pixels.
     */
    convertDimension(dimension: DimensionValue): number {
        return dimension.unit === "rem" ? dimension.value * REM_IN_PX : dimension.value;
    }

    /**
     * Converts typography to text style fields.
     *
     * Returns `undefined` when a field the style cannot do without is a
     * reference: Figma text styles hold values only and cannot alias.
     */
    convertTypography(typography: TypographyValue): FigmaScriptTypography | undefined {
        const family = toFontFamily(typography.fontFamily);
        const size = typography.fontSize;
        if (family === undefined || size instanceof TokenReference) {
            return undefined;
        }

        const letterSpacing = typography.letterSpacing;
        const lineHeight = typography.lineHeight;

        return {
            fontFamily: family,
            fontStyle: toFontStyle(typography.fontWeight),
            fontSize: this.convertDimension(size),
            letterSpacing: letterSpacing instanceof TokenReference
                ? 0
                : this.convertDimension(letterSpacing),
            lineHeight: typeof lineHeight === "number" ? lineHeight : 1,
        };
    }

    /**
     * Converts a shadow layer to a Figma effect.
     *
     * Returns `undefined` when the colour is a reference, for the same reason
     * typography does: an effect style stores values, not links.
     */
    convertShadow(layer: ShadowLayer): FigmaScriptShadow | undefined {
        if (!(layer.color instanceof ColorValueClass)) {
            return undefined;
        }

        return {
            type: layer.inset ? "INNER_SHADOW" : "DROP_SHADOW",
            color: this.convertColor(layer.color),
            offset: {
                x: this.#dimensionOrZero(layer.offsetX),
                y: this.#dimensionOrZero(layer.offsetY),
            },
            radius: this.#dimensionOrZero(layer.blur),
            spread: this.#dimensionOrZero(layer.spread),
        };
    }

    /**
     * Reads a dimension field that may carry a reference instead of a value.
     */
    #dimensionOrZero(value: DimensionValue | TokenReference): number {
        return value instanceof DimensionValue ? this.convertDimension(value) : 0;
    }

    /**
     * Resolves a colour component; the `none` keyword stands for zero.
     */
    #channel(component: ColorComponent | undefined): number {
        return typeof component === "number" ? clamp(component) : 0;
    }
}

/**
 * Picks the font family Figma will look up.
 *
 * DTCG allows a fallback stack, while a Figma text style names one family, so
 * the first entry wins.
 */
function toFontFamily(value: TypographyValue["fontFamily"]): string | undefined {
    if (typeof value === "string") {
        return value.trim() === "" ? undefined : value;
    }

    if (!Array.isArray(value)) {
        return undefined;
    }

    const first = value.find((entry) => typeof entry === "string" && entry.trim() !== "");
    return typeof first === "string" ? first : undefined;
}

/**
 * Maps a font weight to the Figma style name carrying it.
 */
function toFontStyle(weight: TypographyValue["fontWeight"]): string {
    if (weight instanceof TokenReference) {
        return FALLBACK_FONT_STYLE;
    }

    const numeric = typeof weight === "number" ? weight : WEIGHT_BY_KEYWORD[weight];
    if (numeric === undefined) {
        return FALLBACK_FONT_STYLE;
    }

    return FONT_STYLE_BY_WEIGHT.get(toWeightStep(numeric)) ?? FALLBACK_FONT_STYLE;
}

/**
 * Rounds a weight to the nearest step the font style table names.
 */
function toWeightStep(weight: number): number {
    return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
}

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}
