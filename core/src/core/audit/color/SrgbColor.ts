import { ColorValue, isConcreteColorValue, type ConcreteColorValue } from "#/core/model/values/ColorValue";

/**
 * A color in the sRGB space, the space WCAG contrast is defined in.
 *
 * Channels are gamma-encoded, as in CSS `rgb()`, and every field ranges
 * from 0 to 1.
 */
export interface SrgbColor {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
}

type Channels = [number, number, number];
type Matrix = readonly [Channels, Channels, Channels];

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

// Conversion matrices from the CSS Color 4 sample code.
// https://www.w3.org/TR/css-color-4/#color-conversion-code
const XYZ_D65_TO_LINEAR_SRGB: Matrix = [
    [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
    [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
    [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const XYZ_D50_TO_XYZ_D65: Matrix = [
    [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
    [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
    [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const LINEAR_DISPLAY_P3_TO_XYZ_D65: Matrix = [
    [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
    [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
    [0, 0.04511338185890264, 1.043944368900976],
];
const D50_WHITE: Channels = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const LAB_KAPPA = 24389 / 27;
const LAB_EPSILON = 216 / 24389;

/**
 * Converts a DTCG color to sRGB.
 *
 * @remarks
 * Every DTCG color space except `a98-rgb`, `prophoto-rgb` and `rec2020` is
 * converted from its components; for those three, and for components that
 * cannot be read, the 6-digit `hex` fallback is used when present. Colors
 * outside the sRGB gamut are clipped channel by channel, and a `"none"`
 * component counts as 0, as CSS does when it renders a color.
 *
 * @returns The sRGB color, or `undefined` when the color holds a property
 *   reference or can be read neither from its components nor from `hex`.
 */
export function toSrgbColor(color: ColorValue): SrgbColor | undefined {
    if (!isConcreteColorValue(color)) return undefined;

    const channels = fromComponents(color) ?? fromHex(color.hex);
    if (channels === undefined) return undefined;

    return {
        red: clamp(channels[0]),
        green: clamp(channels[1]),
        blue: clamp(channels[2]),
        alpha: Number.isFinite(color.alpha) ? clamp(color.alpha) : 1,
    };
}

/**
 * Formats an sRGB color as `#rrggbb`, with an `aa` alpha suffix when the color
 * is translucent.
 */
export function formatSrgbColor(color: SrgbColor): string {
    const hex = [color.red, color.green, color.blue].map(toByte).join("");
    return color.alpha < 1 ? `#${hex}${toByte(color.alpha)}` : `#${hex}`;
}

/**
 * Converts a gamma-encoded sRGB channel to linear light.
 */
export function linearizeSrgbChannel(value: number): number {
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromComponents(color: ConcreteColorValue): Channels | undefined {
    const components = color.components.slice(0, 3).map((component) => component === "none" ? 0 : component);
    if (components.length < 3 || !components.every(Number.isFinite)) return undefined;
    const [c1, c2, c3] = components as Channels;

    switch (color.colorSpace) {
        case "srgb":
            return [c1, c2, c3];
        case "srgb-linear":
            return encodeSrgb([c1, c2, c3]);
        case "hsl":
            return hslToSrgb(c1, c2 / 100, c3 / 100);
        case "hwb":
            return hwbToSrgb(c1, c2 / 100, c3 / 100);
        case "display-p3":
            return xyzD65ToSrgb(multiply(LINEAR_DISPLAY_P3_TO_XYZ_D65, [c1, c2, c3].map(linearizeSrgbChannel) as Channels));
        case "xyz-d65":
            return xyzD65ToSrgb([c1, c2, c3]);
        case "xyz-d50":
            return xyzD65ToSrgb(multiply(XYZ_D50_TO_XYZ_D65, [c1, c2, c3]));
        case "lab":
            return xyzD65ToSrgb(multiply(XYZ_D50_TO_XYZ_D65, labToXyzD50(c1, c2, c3)));
        case "lch":
            return xyzD65ToSrgb(multiply(XYZ_D50_TO_XYZ_D65, labToXyzD50(c1, ...polarToCartesian(c2, c3))));
        case "oklab":
            return encodeSrgb(oklabToLinearSrgb(c1, c2, c3));
        case "oklch":
            return encodeSrgb(oklabToLinearSrgb(c1, ...polarToCartesian(c2, c3)));
        default:
            return undefined;
    }
}

function fromHex(hex: string | undefined): Channels | undefined {
    const match = hex?.match(HEX_PATTERN);
    if (match === null || match === undefined) return undefined;
    const value = match[1];
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as Channels;
}

function hslToSrgb(hue: number, saturation: number, lightness: number): Channels {
    const h = ((hue % 360) + 360) % 360;
    const amount = saturation * Math.min(lightness, 1 - lightness);
    const channel = (n: number): number => {
        const k = (n + h / 30) % 12;
        return lightness - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [channel(0), channel(8), channel(4)];
}

function hwbToSrgb(hue: number, whiteness: number, blackness: number): Channels {
    if (whiteness + blackness >= 1) {
        const gray = whiteness / (whiteness + blackness);
        return [gray, gray, gray];
    }
    return hslToSrgb(hue, 1, 0.5).map((channel) => channel * (1 - whiteness - blackness) + whiteness) as Channels;
}

function labToXyzD50(lightness: number, a: number, b: number): Channels {
    const f1 = (lightness + 16) / 116;
    const f0 = a / 500 + f1;
    const f2 = f1 - b / 200;
    const x = f0 ** 3 > LAB_EPSILON ? f0 ** 3 : (116 * f0 - 16) / LAB_KAPPA;
    const y = lightness > LAB_KAPPA * LAB_EPSILON ? f1 ** 3 : lightness / LAB_KAPPA;
    const z = f2 ** 3 > LAB_EPSILON ? f2 ** 3 : (116 * f2 - 16) / LAB_KAPPA;
    return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
}

// https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
function oklabToLinearSrgb(lightness: number, a: number, b: number): Channels {
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
}

function polarToCartesian(chroma: number, hue: number): [number, number] {
    const radians = (hue * Math.PI) / 180;
    return [chroma * Math.cos(radians), chroma * Math.sin(radians)];
}

function xyzD65ToSrgb(xyz: Channels): Channels {
    return encodeSrgb(multiply(XYZ_D65_TO_LINEAR_SRGB, xyz));
}

function encodeSrgb(linear: Channels): Channels {
    return linear.map((value) => {
        const magnitude = Math.abs(value);
        const encoded = magnitude <= 0.0031308 ? 12.92 * magnitude : 1.055 * magnitude ** (1 / 2.4) - 0.055;
        return Math.sign(value) * encoded;
    }) as Channels;
}

function multiply(matrix: Matrix, vector: Channels): Channels {
    return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]) as Channels;
}

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function toByte(value: number): string {
    return Math.round(clamp(value) * 255).toString(16).padStart(2, "0");
}
