/**
 * Converts DTCG token values into Figma value shapes.
 *
 * This is the inverse of the value helpers in `token-export/TokenExporter`:
 * `toDtcgColorValue`, `toDimensionValue`, `toFontWeight` and the shadow mapping.
 */

/** Token types that Figma can represent. Everything else is skipped on import. */
export const SUPPORTED_TOKEN_TYPES = [
    "color",
    "dimension",
    "number",
    "typography",
    "shadow",
] as const;

export type SupportedTokenType = (typeof SUPPORTED_TOKEN_TYPES)[number];

/** Token types with no Figma representation, reported as skipped. */
export const UNSUPPORTED_TOKEN_TYPES = [
    "fontFamily",
    "fontWeight",
    "duration",
    "cubicBezier",
    "strokeStyle",
    "border",
    "transition",
    "gradient",
] as const;

export type UnsupportedTokenType = (typeof UNSUPPORTED_TOKEN_TYPES)[number];

export function isSupportedTokenType(type: string): type is SupportedTokenType {
    return (SUPPORTED_TOKEN_TYPES as readonly string[]).includes(type);
}

export function toUnsupportedReason(type: string): string {
    return UNSUPPORTED_REASONS[type as UnsupportedTokenType]
        ?? `Figma has no representation for the "${type}" token type`;
}

/** Why a given type cannot be represented, shown in the import report. */
const UNSUPPORTED_REASONS: Record<UnsupportedTokenType, string> = {
    fontFamily: "Figma has no font family variable; the family lives inside a text style",
    fontWeight: "Figma has no font weight variable; the weight lives inside a text style",
    duration: "Figma has no duration variable type",
    cubicBezier: "Figma has no easing variable type",
    strokeStyle: "Figma has no stroke style variable type",
    border: "Figma has no composite border variable; use separate width and color tokens",
    transition: "Figma has no transition variable type",
    gradient: "Figma has no gradient variable type; use a paint style instead",
};

export interface RgbaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

/** Converts a DTCG color value to a Figma RGBA color. */
export function toFigmaColor(value: unknown): RgbaColor | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const components = value["components"];
    if (!Array.isArray(components) || components.length < 3) {
        return undefined;
    }

    const [r, g, b] = components;
    if (!isFiniteNumber(r) || !isFiniteNumber(g) || !isFiniteNumber(b)) {
        return undefined;
    }

    const alpha = value["alpha"];

    return {
        r: clampChannel(r),
        g: clampChannel(g),
        b: clampChannel(b),
        a: isFiniteNumber(alpha) ? clampChannel(alpha) : 1,
    };
}

/**
 * Converts a DTCG dimension to a Figma float.
 *
 * Figma variables are unitless and interpreted as pixels, so `rem` values are
 * converted at the CSS default root size. The caller reports the conversion.
 */
const REM_IN_PX = 16;

export function toFigmaDimension(value: unknown): { value: number; converted: boolean } | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const amount = value["value"];
    if (!isFiniteNumber(amount)) {
        return undefined;
    }

    const unit = value["unit"];
    if (unit === "rem") {
        return { value: amount * REM_IN_PX, converted: true };
    }

    if (unit !== "px" && unit !== undefined) {
        return undefined;
    }

    return { value: amount, converted: false };
}

export function toFigmaNumber(value: unknown): number | undefined {
    return isFiniteNumber(value) ? value : undefined;
}

/**
 * Converts a DTCG typography value to Figma text style fields.
 *
 * `fontWeight` is mapped to a font style name that `toFontWeight` in the
 * exporter maps back to the same number, keeping the round trip stable.
 * `lineHeight` is a unitless multiplier in DTCG and a percentage in Figma.
 */
export interface FigmaTypography {
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    letterSpacing: number;
    lineHeight: number;
}

export function toFigmaTypography(value: unknown): FigmaTypography | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const fontSize = toFigmaDimension(value["fontSize"]);
    if (fontSize === undefined) {
        return undefined;
    }

    const family = toFontFamily(value["fontFamily"]);
    if (family === undefined) {
        return undefined;
    }

    const letterSpacing = toFigmaDimension(value["letterSpacing"]);
    const lineHeight = value["lineHeight"];

    return {
        fontFamily: family,
        fontStyle: toFontStyleName(value["fontWeight"]),
        fontSize: fontSize.value,
        letterSpacing: letterSpacing?.value ?? 0,
        lineHeight: isFiniteNumber(lineHeight) ? lineHeight : 1,
    };
}

export interface FigmaShadowEffect {
    type: "DROP_SHADOW" | "INNER_SHADOW";
    color: RgbaColor;
    offset: { x: number; y: number };
    radius: number;
    spread: number;
    visible: true;
    blendMode: "NORMAL";
}

/** Converts a DTCG shadow value, single or multi-layer, to Figma effects. */
export function toFigmaShadow(value: unknown): FigmaShadowEffect[] | undefined {
    const layers = Array.isArray(value) ? value : [value];
    const effects: FigmaShadowEffect[] = [];

    for (const layer of layers) {
        const effect = toShadowEffect(layer);
        if (effect === undefined) {
            return undefined;
        }

        effects.push(effect);
    }

    return effects.length === 0 ? undefined : effects;
}

function toShadowEffect(layer: unknown): FigmaShadowEffect | undefined {
    if (!isRecord(layer)) {
        return undefined;
    }

    const color = toFigmaColor(layer["color"]);
    if (color === undefined) {
        return undefined;
    }

    return {
        type: layer["inset"] === true ? "INNER_SHADOW" : "DROP_SHADOW",
        color,
        offset: {
            x: toFigmaDimension(layer["offsetX"])?.value ?? 0,
            y: toFigmaDimension(layer["offsetY"])?.value ?? 0,
        },
        radius: toFigmaDimension(layer["blur"])?.value ?? 0,
        spread: toFigmaDimension(layer["spread"])?.value ?? 0,
        visible: true,
        blendMode: "NORMAL",
    };
}

/**
 * Font style names the exporter's `toFontWeight` maps back to the same weight.
 *
 * Weights outside this table cannot round-trip, so they fall back to the
 * nearest standard name.
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

function toFontStyleName(weight: unknown): string {
    if (typeof weight === "string") {
        return weight;
    }

    if (!isFiniteNumber(weight)) {
        return FALLBACK_FONT_STYLE;
    }

    return FONT_STYLE_BY_WEIGHT.get(roundToHundred(weight)) ?? FALLBACK_FONT_STYLE;
}

function roundToHundred(weight: number): number {
    return Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
}

/** DTCG allows a font stack; Figma holds a single family, so the first wins. */
function toFontFamily(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim() !== "") {
        return value;
    }

    if (Array.isArray(value)) {
        const first = value.find((entry) => typeof entry === "string" && entry.trim() !== "");
        return typeof first === "string" ? first : undefined;
    }

    return undefined;
}

function clampChannel(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
