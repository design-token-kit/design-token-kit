import { TokenReference } from "#/core/model/TokenReference";

/**
 * Color space identifiers supported by the DTCG 2025.10 specification.
 *
 * @see https://tr.designtokens.org/format/#color
 */
export type ColorSpace =
    | "srgb"
    | "srgb-linear"
    | "hsl"
    | "hwb"
    | "lab"
    | "lch"
    | "oklab"
    | "oklch"
    | "display-p3"
    | "a98-rgb"
    | "prophoto-rgb"
    | "rec2020"
    | "xyz-d65"
    | "xyz-d50";

/**
 * A single color channel component. The numeric range and meaning depend on the color space.
 * The special string value `"none"` indicates a missing component.
 *
 * @see https://tr.designtokens.org/format/#color
 */
export type ColorComponent = number | "none";

/**
 * Represents a color value in a specific color space.
 *
 * Components are ordered as defined by the color space (e.g., [R, G, B] for sRGB,
 * [H, S, L] for HSL). The `hex` field is an optional 6-digit CSS fallback.
 *
 * @see https://tr.designtokens.org/format/#color
 */
export class ColorValue {
    readonly colorSpace: ColorSpace;
    readonly components: ColorComponent[];
    /** Alpha channel, 0 (transparent) to 1 (opaque). Defaults to 1. */
    readonly alpha: number;
    /** Optional 6-digit hex fallback, e.g. `#ff00ff`. */
    readonly hex: string | undefined;

    constructor(
        colorSpace: ColorSpace,
        components: ColorComponent[],
        alpha = 1,
        hex?: string,
    ) {
        this.colorSpace = colorSpace;
        this.components = components;
        this.alpha = alpha;
        this.hex = hex;
    }
}

/** A color value or a reference to another color token. */
export type ColorOrReference = ColorValue | TokenReference;
