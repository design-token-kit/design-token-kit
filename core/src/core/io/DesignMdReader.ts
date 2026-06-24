import { parseDocument } from "yaml";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue, DimensionUnit } from "#/core/model/values/DimensionValue";
import { TypographyValue, FontWeightOrReference } from "#/core/model/values/TypographyValue";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|em|rem)$/;
const REFERENCE_RE = /^\{[^{}]+\}$/;
const HEX_RE = /^#([0-9a-fA-F]{3,8})$/;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/;
const HSL_RE = /^hsla?\(\s*(-?[\d.]+)\s*,?\s*(-?[\d.]+)%\s*,?\s*(-?[\d.]+)%(?:\s*,?\s*([\d.]+))?\s*\)$/;
const HWB_RE = /^hwb\(\s*(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)$/;
const LAB_RE = /^lab\(\s*(-?[\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/;
const LCH_RE = /^lch\(\s*(-?[\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/;
const OKLAB_RE = /^oklab\(\s*(-?[\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/;
const OKLCH_RE = /^oklch\(\s*(-?[\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/;

const NAMED_COLORS: Record<string, [number, number, number, string]> = {
    transparent: [0, 0, 0, "000000"],
    red: [255, 0, 0, "ff0000"],
    green: [0, 128, 0, "008000"],
    blue: [0, 0, 255, "0000ff"],
    white: [255, 255, 255, "ffffff"],
    black: [0, 0, 0, "000000"],
    gray: [128, 128, 128, "808080"],
    grey: [128, 128, 128, "808080"],
    silver: [192, 192, 192, "c0c0c0"],
    yellow: [255, 255, 0, "ffff00"],
    orange: [255, 165, 0, "ffa500"],
    purple: [128, 0, 128, "800080"],
    pink: [255, 192, 203, "ffc0cb"],
    brown: [165, 42, 42, "a52a2a"],
    cyan: [0, 255, 255, "00ffff"],
    magenta: [255, 0, 255, "ff00ff"],
    lime: [0, 255, 0, "00ff00"],
    navy: [0, 0, 128, "000080"],
    teal: [0, 128, 128, "008080"],
    olive: [128, 128, 0, "808000"],
    maroon: [128, 0, 0, "800000"],
    coral: [255, 127, 80, "ff7f50"],
    salmon: [250, 128, 114, "fa8072"],
    tomato: [255, 99, 71, "ff6347"],
    gold: [255, 215, 0, "ffd700"],
    violet: [238, 130, 238, "ee82ee"],
    indigo: [75, 0, 130, "4b0082"],
    turquoise: [64, 224, 208, "40e0d0"],
    crimson: [220, 20, 60, "dc143c"],
    beige: [245, 245, 220, "f5f5dc"],
    ivory: [255, 255, 240, "fffff0"],
    snow: [255, 250, 250, "fffafa"],
    linen: [250, 240, 230, "faf0e6"],
    khaki: [240, 230, 140, "f0e68c"],
    plum: [221, 160, 221, "dda0dd"],
    orchid: [218, 112, 214, "da70d6"],
    sienna: [160, 82, 45, "a0522d"],
    peru: [205, 133, 63, "cd853f"],
    tan: [210, 180, 140, "d2b48c"],
    wheat: [245, 222, 179, "f5deb3"],
    mintcream: [245, 255, 250, "f5fffa"],
    lavender: [230, 230, 250, "e6e6fa"],
    azure: [240, 255, 255, "f0ffff"],
    cornflowerblue: [100, 149, 237, "6495ed"],
    lightblue: [173, 216, 230, "add8e6"],
    lightgreen: [144, 238, 144, "90ee90"],
    lightpink: [255, 182, 193, "ffb6c1"],
    lightyellow: [255, 255, 224, "ffffe0"],
    lightgray: [211, 211, 211, "d3d3d3"],
    lightgrey: [211, 211, 211, "d3d3d3"],
    darkgray: [169, 169, 169, "a9a9a9"],
    darkgrey: [169, 169, 169, "a9a9a9"],
    darkblue: [0, 0, 139, "00008b"],
    darkgreen: [0, 100, 0, "006400"],
    darkred: [139, 0, 0, "8b0000"],
    darkorange: [255, 140, 0, "ff8c00"],
    darkviolet: [148, 0, 211, "9400d3"],
    dimgray: [105, 105, 105, "696969"],
    dimgrey: [105, 105, 105, "696969"],
    slategray: [112, 128, 144, "708090"],
    slategrey: [112, 128, 144, "708090"],
};

type ComponentPropertyType = "color" | "dimension" | "typography";

const COMPONENT_PROPERTY_TYPES: Record<string, ComponentPropertyType> = {
    backgroundColor: "color",
    textColor: "color",
    typography: "typography",
    rounded: "dimension",
    padding: "dimension",
    size: "dimension",
    height: "dimension",
    width: "dimension",
};

/**
 * Reads a DESIGN.md markdown file and parses its YAML frontmatter into
 * a {@link Dtcg} model.
 *
 * The markdown body (prose sections) is ignored.
 *
 * @see https://github.com/google-labs-code/design.md
 */
export class DesignMdReader {

    /**
     * Extracts and parses the raw YAML frontmatter from DESIGN.md content
     * without converting to the Dtcg model. Used by schema validators.
     */
    parseRaw(content: string): unknown {
        return parseDocument(content).toJS();
    }

    /**
     * Parses full DESIGN.md content into a {@link Dtcg} document.
     */
    parse(content: string, source?: string): Dtcg {
        const raw = parseDocument(content).toJS();
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            return new Dtcg(new TokenGroup({}), source);
        }
        const root = this.#parseRoot(raw as JsonObject);
        return new Dtcg(root, source);
    }

    #parseRoot(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        const extensions: Record<string, unknown> = {};
        const description = typeof raw["description"] === "string" ? raw["description"] : undefined;

        if (typeof raw["name"] === "string") extensions["name"] = raw["name"];
        if (typeof raw["version"] === "string") extensions["version"] = raw["version"];

        if (this.#isObject(raw["colors"])) {
            children.set("colors", this.#parseColors(raw["colors"] as JsonObject));
        }
        if (this.#isObject(raw["typography"])) {
            children.set("typography", this.#parseTypographies(raw["typography"] as JsonObject));
        }
        if (this.#isObject(raw["rounded"])) {
            children.set("rounded", this.#parseDimensions(raw["rounded"] as JsonObject));
        }
        if (this.#isObject(raw["spacing"])) {
            children.set("spacing", this.#parseSpacings(raw["spacing"] as JsonObject));
        }
        if (this.#isObject(raw["components"])) {
            children.set("components", this.#parseComponents(raw["components"] as JsonObject));
        }

        return new TokenGroup({ description, extensions, children });
    }

    #parseColors(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (typeof value === "string" && REFERENCE_RE.test(value)) {
                children.set(name, new AliasToken(new TokenReference(value.slice(1, -1))));
            } else if (typeof value === "string") {
                children.set(name, new ColorToken(this.#parseColor(value)));
            }
        }
        return new TokenGroup({ children });
    }

    #parseTypographies(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (typeof value === "string" && REFERENCE_RE.test(value)) {
                children.set(name, new TypographyToken(new TokenReference(value.slice(1, -1))));
            } else if (this.#isObject(value)) {
                children.set(name, new TypographyToken(this.#parseTypographyValue(value as JsonObject)));
            }
        }
        return new TokenGroup({ children });
    }

    #parseDimensions(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (typeof value === "string" && REFERENCE_RE.test(value)) {
                children.set(name, new DimensionToken(new TokenReference(value.slice(1, -1))));
            } else if (typeof value === "string") {
                children.set(name, new DimensionToken(this.#parseDimension(value)));
            }
        }
        return new TokenGroup({ children });
    }

    #parseSpacings(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (typeof value === "string" && REFERENCE_RE.test(value)) {
                children.set(name, new DimensionToken(new TokenReference(value.slice(1, -1))));
            } else if (typeof value === "string") {
                children.set(name, new DimensionToken(this.#parseDimension(value)));
            } else if (typeof value === "number") {
                children.set(name, new NumberToken(value));
            }
        }
        return new TokenGroup({ children });
    }

    #parseComponents(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (!this.#isObject(value)) continue;
            children.set(name, this.#parseComponent(value as JsonObject));
        }
        return new TokenGroup({ children });
    }

    #parseComponent(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [propName, propValue] of Object.entries(raw)) {
            const propType = COMPONENT_PROPERTY_TYPES[propName];
            if (propType === undefined) {
                if (typeof propValue === "string" && REFERENCE_RE.test(propValue)) {
                    children.set(propName, new AliasToken(new TokenReference(propValue.slice(1, -1))));
                }
                continue;
            }
            children.set(propName, this.#parseComponentProperty(propValue, propType));
        }
        return new TokenGroup({ children });
    }

    #parseComponentProperty(value: JsonValue, propType: ComponentPropertyType): TokenNode<unknown> {
        if (typeof value === "string" && REFERENCE_RE.test(value)) {
            const ref = new TokenReference(value.slice(1, -1));
            switch (propType) {
                case "color": return new ColorToken(ref);
                case "dimension": return new DimensionToken(ref);
                case "typography": return new TypographyToken(ref);
            }
        }
        switch (propType) {
            case "color":
                if (typeof value === "string") return new ColorToken(this.#parseColor(value));
                break;
            case "dimension":
                if (typeof value === "string") return new DimensionToken(this.#parseDimension(value));
                break;
            case "typography":
                if (typeof value === "string") return new TypographyToken(new TokenReference(value));
                break;
        }
        throw new DesignMdReaderError(`Unexpected value for component property of type "${propType}": ${JSON.stringify(value)}`);
    }

    #parseTypographyValue(raw: JsonObject): TypographyValue {
        const fontFamily = this.#parseFontFamilyOrRef(raw["fontFamily"]);
        const fontSize = this.#parseDimensionOrRef(raw["fontSize"]);
        const fontWeight = this.#parseFontWeightOrRef(raw["fontWeight"]);
        const letterSpacing = this.#parseDimensionOrRef(raw["letterSpacing"]);
        const lineHeight = this.#parseNumberOrRef(raw["lineHeight"]);
        return new TypographyValue(fontFamily, fontSize, fontWeight, letterSpacing, lineHeight);
    }

    #parseColor(value: string): ColorValue {
        const trimmed = value.trim();

        if (HEX_RE.test(trimmed)) {
            return this.#parseHex(trimmed);
        }

        if (trimmed in NAMED_COLORS) {
            const [r, g, b, hex] = NAMED_COLORS[trimmed];
            return new ColorValue(
                "srgb",
                [this.#round(r / 255), this.#round(g / 255), this.#round(b / 255)],
                1,
                `#${hex}`,
            );
        }

        if (trimmed === "transparent") {
            return new ColorValue("srgb", [0, 0, 0], 0, "#000000");
        }

        const rgbMatch = trimmed.match(RGB_RE);
        if (rgbMatch) {
            return new ColorValue(
                "srgb",
                [
                    this.#round(parseInt(rgbMatch[1], 10) / 255),
                    this.#round(parseInt(rgbMatch[2], 10) / 255),
                    this.#round(parseInt(rgbMatch[3], 10) / 255),
                ],
                rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
                this.#rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])),
            );
        }

        const hslMatch = trimmed.match(HSL_RE);
        if (hslMatch) {
            return new ColorValue(
                "hsl",
                [
                    parseFloat(hslMatch[1]),
                    parseFloat(hslMatch[2]),
                    parseFloat(hslMatch[3]),
                ],
                hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1,
            );
        }

        const hwbMatch = trimmed.match(HWB_RE);
        if (hwbMatch) {
            return new ColorValue(
                "hwb",
                [
                    parseFloat(hwbMatch[1]),
                    parseFloat(hwbMatch[2]),
                    parseFloat(hwbMatch[3]),
                ],
                hwbMatch[4] !== undefined ? parseFloat(hwbMatch[4]) : 1,
            );
        }

        const labMatch = trimmed.match(LAB_RE);
        if (labMatch) {
            return new ColorValue(
                "lab",
                [
                    parseFloat(labMatch[1]),
                    parseFloat(labMatch[2]),
                    parseFloat(labMatch[3]),
                ],
                labMatch[4] !== undefined ? parseFloat(labMatch[4]) : 1,
            );
        }

        const lchMatch = trimmed.match(LCH_RE);
        if (lchMatch) {
            return new ColorValue(
                "lch",
                [
                    parseFloat(lchMatch[1]),
                    parseFloat(lchMatch[2]),
                    parseFloat(lchMatch[3]),
                ],
                lchMatch[4] !== undefined ? parseFloat(lchMatch[4]) : 1,
            );
        }

        const oklabMatch = trimmed.match(OKLAB_RE);
        if (oklabMatch) {
            return new ColorValue(
                "oklab",
                [
                    parseFloat(oklabMatch[1]),
                    parseFloat(oklabMatch[2]),
                    parseFloat(oklabMatch[3]),
                ],
                oklabMatch[4] !== undefined ? parseFloat(oklabMatch[4]) : 1,
            );
        }

        const oklchMatch = trimmed.match(OKLCH_RE);
        if (oklchMatch) {
            return new ColorValue(
                "oklch",
                [
                    parseFloat(oklchMatch[1]),
                    parseFloat(oklchMatch[2]),
                    parseFloat(oklchMatch[3]),
                ],
                oklchMatch[4] !== undefined ? parseFloat(oklchMatch[4]) : 1,
            );
        }

        throw new DesignMdReaderError(`Unable to parse color value: "${value}"`);
    }

    #parseHex(value: string): ColorValue {
        const hex = value.replace("#", "").toLowerCase();
        let r: number, g: number, b: number, alpha = 1;
        let hex6: string;

        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
            hex6 = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        } else if (hex.length === 4) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
            alpha = this.#round(parseInt(hex[3] + hex[3], 16) / 255);
            hex6 = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        } else if (hex.length === 6) {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            hex6 = hex;
        } else {
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            alpha = this.#round(parseInt(hex.slice(6, 8), 16) / 255);
            hex6 = hex.slice(0, 6);
        }

        return new ColorValue(
            "srgb",
            [this.#round(r / 255), this.#round(g / 255), this.#round(b / 255)],
            alpha,
            `#${hex6}`,
        );
    }

    #parseDimension(value: string): DimensionValue {
        const match = value.match(DIMENSION_RE);
        if (!match) {
            throw new DesignMdReaderError(`Expected dimension with px/em/rem unit, got: "${value}"`);
        }
        return new DimensionValue(Number(match[1]), match[2] as DimensionUnit);
    }

    #parseFontFamilyOrRef(raw: unknown): string | string[] | TokenReference {
        if (typeof raw === "string") {
            if (REFERENCE_RE.test(raw)) return new TokenReference(raw.slice(1, -1));
            return raw;
        }
        if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) return raw as string[];
        throw new DesignMdReaderError(`Expected fontFamily string or array, got: ${JSON.stringify(raw)}`);
    }

    #parseDimensionOrRef(raw: unknown): DimensionValue | TokenReference {
        if (typeof raw === "string") {
            if (REFERENCE_RE.test(raw)) return new TokenReference(raw.slice(1, -1));
            return this.#parseDimension(raw);
        }
        throw new DesignMdReaderError(`Expected dimension string, got: ${JSON.stringify(raw)}`);
    }

    #parseFontWeightOrRef(raw: unknown): FontWeightOrReference {
        if (typeof raw === "string") {
            if (REFERENCE_RE.test(raw)) return new TokenReference(raw.slice(1, -1));
            return raw as FontWeightOrReference;
        }
        if (typeof raw === "number") return raw;
        throw new DesignMdReaderError(`Expected fontWeight string or number, got: ${JSON.stringify(raw)}`);
    }

    #parseNumberOrRef(raw: unknown): number | TokenReference {
        if (typeof raw === "string" && REFERENCE_RE.test(raw)) return new TokenReference(raw.slice(1, -1));
        if (typeof raw === "number") return raw;
        throw new DesignMdReaderError(`Expected number, got: ${JSON.stringify(raw)}`);
    }

    #rgbToHex(r: number, g: number, b: number): string {
        const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    #round(value: number): number {
        return Number(value.toFixed(3));
    }

    #isObject(value: JsonValue): value is JsonObject {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }
}

/**
 * Thrown when the DESIGN.md content does not conform to the expected format.
 */
export class DesignMdReaderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DesignMdReaderError";
    }
}
