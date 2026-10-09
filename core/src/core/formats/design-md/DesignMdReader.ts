import { parse as parseYaml } from "yaml";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { IssueCollector } from "#/core/formats/support/IssueCollector";
import { ReadContext, readToken } from "#/core/formats/support/ReadContext";
import { TokenReadError } from "#/core/formats/support/TokenReadError";
import { noSchemaValidator, type SchemaValidator } from "#/core/formats/support/SchemaValidator";
import { readDocuments, readFailed, type ReadResult, type TokenReader } from "#/core/formats/TokenReader";
import { isJsonObject, round, type JsonObject, type JsonValue } from "#/core/formats/support/Json";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue, DimensionUnit } from "#/core/model/values/DimensionValue";
import { TypographyValue, FontWeightOrReference } from "#/core/model/values/TypographyValue";


export const DESIGN_MD_SCHEMA_ID = "https://designtokens.local/schemas/design-md-tokens.json";



/**
 * Reads a DESIGN.md markdown file and parses its YAML frontmatter into
 * a {@link Dtcg} model.
 *
 * The markdown body (prose sections) is ignored.
 *
 * @see https://github.com/google-labs-code/design.md
 */
export class DesignMdReader implements TokenReader {
    readonly #schema: SchemaValidator;

    /**
     * Builds a reader for a schema already in memory.
     *
     * Prefer {@link create}, which loads the schema this format ships.
     * Pass a validator here when the schema is embedded rather than on disk,
     * as the browser entry does, or call {@link noSchema} to read without
     * one.
     *
     * @param schema - Validator for this format's JSON Schema.
     */
    constructor(schema: SchemaValidator) {
        this.#schema = schema;
    }

    /**
     * Creates a reader that validates against this format's JSON Schema.
     *
     * The schema is read from disk once, here, which is what lets {@link read}
     * stay synchronous afterwards.
     */
    static async create(): Promise<DesignMdReader> {
        // Imported on call. The module that loads schemas imports this one, so
        // a static import would close the cycle, and it reaches the file
        // system, which a browser bundle importing this reader must not.
        const { designMdSchemaValidator } = await import("#/core/formats/design-md/designMdSchema");
        return new DesignMdReader(await designMdSchemaValidator());
    }

    /**
     * Creates a reader that checks the token model but no JSON Schema.
     *
     * For an environment that cannot load one: the Figma plugin bundle has no
     * file system, and the browser entry uses this for model parsing, having
     * already run the schema stage against its embedded schemas.
     *
     * Document structure goes unchecked, where the schema would reject it.
     */
    static noSchema(): DesignMdReader {
        return new DesignMdReader(noSchemaValidator);
    }


    /**
     * Reads a DESIGN.md document.
     *
     * Runs in stages, each gating the next: frontmatter, then the token model,
     * then the JSON Schema. The model comes before the schema because it names
     * the token that failed, where the schema reports a pattern that did not
     * match.
     */
    read(content: string, sourceId?: string): ReadResult {
        const collector = new IssueCollector(sourceId);

        const raw = this.#parseRaw(content);
        if (!isJsonObject(raw)) {
            collector.add("missing-frontmatter", "DESIGN.md must start with YAML frontmatter holding token definitions.");
            return readFailed(collector.issues);
        }

        const document = new Dtcg(this.#parseRoot(raw, new ReadContext(collector)), sourceId);
        if (collector.failed) {
            return readFailed(collector.issues);
        }

        this.#schema.validate(raw, collector);
        this.#reportIgnoredValues(raw, collector);

        return collector.failed ? readFailed(collector.issues) : readDocuments([document], collector.issues);
    }

    /**
     * Reports values the DESIGN.md specification accepts but the token model
     * cannot hold, so they are dropped rather than silently lost.
     *
     * These are warnings, not errors: the documents stay usable without them.
     */
    #reportIgnoredValues(raw: JsonObject, collector: IssueCollector): void {
        const spacing = raw["spacing"];
        if (isJsonObject(spacing)) {
            for (const [name, value] of Object.entries(spacing)) {
                if (typeof value !== "string") continue;
                if (TokenReference.parse(value) !== undefined) continue;
                if (DIMENSION_RE.test(value)) continue;
                collector.add(
                    "design-md-ignored-value",
                    `spacing.${name}: "${value}" is not a dimension and is ignored.`,
                    { severity: "warning" },
                );
            }
        }

        const components = raw["components"];
        if (!isJsonObject(components)) return;
        for (const [component, properties] of Object.entries(components)) {
            if (!isJsonObject(properties)) continue;
            for (const [property, value] of Object.entries(properties)) {
                if (COMPONENT_PROPERTY_TYPES[property] !== undefined) continue;
                if (typeof value === "string" && TokenReference.parse(value) !== undefined) continue;
                collector.add(
                    "design-md-ignored-value",
                    `components.${component}.${property}: unknown component property is ignored. `
                    + "Use a token reference to keep it.",
                    { severity: "warning" },
                );
            }
        }
    }

    /**
     * Extracts and parses the raw YAML frontmatter, without building the
     * token model.
     */
    #parseRaw(content: string): unknown {
        const blocks = this.#extractYamlBlocks(content);
        if (blocks.length === 0) return null;
        return Object.assign({}, ...blocks.map((b) => parseYaml(b)));
    }

    /**
     * Returns `true` when the content looks like a DESIGN.md file.
     *
     * DESIGN.md files contain YAML frontmatter between {@code ---} delimiters
     * followed by markdown prose with {@code ##} section headings.
     */
    static isDesignMd(content: string): boolean {
        const frontmatter = extractFrontmatter(content);
        return frontmatter !== undefined && hasMarkdownHeading(frontmatter.body);
    }

    #extractYamlBlocks(content: string): string[] {
        const frontmatter = extractFrontmatter(content);
        return frontmatter === undefined ? [] : [frontmatter.yaml];
    }

    #parseRoot(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        const extensions: Record<string, unknown> = {};
        const description = typeof raw["description"] === "string" ? raw["description"] : undefined;

        if (typeof raw["name"] === "string") extensions["name"] = raw["name"];
        if (typeof raw["version"] === "string") extensions["version"] = raw["version"];

        if (isJsonObject(raw["colors"])) {
            children.set("colors", this.#parseColors(raw["colors"] as JsonObject, ctx.enter("colors")));
        }
        if (isJsonObject(raw["typography"])) {
            const typography = this.#parseTypographies(raw["typography"] as JsonObject, ctx.enter("typography"));
            children.set("typography", typography);
        }
        if (isJsonObject(raw["rounded"])) {
            children.set("rounded", this.#parseDimensions(raw["rounded"] as JsonObject, ctx.enter("rounded")));
        }
        if (isJsonObject(raw["spacing"])) {
            children.set("spacing", this.#parseSpacings(raw["spacing"] as JsonObject, ctx.enter("spacing")));
        }
        if (isJsonObject(raw["components"])) {
            children.set("components", this.#parseComponents(raw["components"] as JsonObject, ctx.enter("components")));
        }

        return new TokenGroup({ description, extensions, children });
    }

    #parseColors(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            const tokenCtx = ctx.enter(name);
            const ref = TokenReference.parse(value);
            if (ref !== undefined) {
                children.set(name, new AliasToken(ref));
                continue;
            }
            if (!(typeof value === "string")) {
                tokenCtx.report("invalid-value", `Expected a value or a reference, got: ${JSON.stringify(value)}`);
                continue;
            }
            const token = readToken(tokenCtx, () => new ColorToken(this.#parseColor(value)));
            if (token !== undefined) {
                children.set(name, token);
            }
        }
        return new TokenGroup({ children });
    }

    #parseTypographies(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            const tokenCtx = ctx.enter(name);
            const ref = TokenReference.parse(value);
            if (ref !== undefined) {
                children.set(name, new TypographyToken(ref));
                continue;
            }
            if (!(isJsonObject(value))) {
                tokenCtx.report("invalid-value", `Expected a value or a reference, got: ${JSON.stringify(value)}`);
                continue;
            }
            const token = readToken(tokenCtx, () => new TypographyToken(this.#parseTypographyValue(value as JsonObject)));
            if (token !== undefined) {
                children.set(name, token);
            }
        }
        return new TokenGroup({ children });
    }

    #parseDimensions(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            const tokenCtx = ctx.enter(name);
            const ref = TokenReference.parse(value);
            if (ref !== undefined) {
                children.set(name, new AliasToken(ref));
                continue;
            }
            if (!(typeof value === "string")) {
                tokenCtx.report("invalid-value", `Expected a value or a reference, got: ${JSON.stringify(value)}`);
                continue;
            }
            const token = readToken(tokenCtx, () => new DimensionToken(this.#parseDimension(value)));
            if (token !== undefined) {
                children.set(name, token);
            }
        }
        return new TokenGroup({ children });
    }

    #parseSpacings(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            const tokenCtx = ctx.enter(name);
            const ref = TokenReference.parse(value);
            if (ref !== undefined) {
                children.set(name, new AliasToken(ref));
                continue;
            }
            if (typeof value === "number") {
                children.set(name, new NumberToken(value));
                continue;
            }
            if (typeof value !== "string") {
                tokenCtx.report("invalid-value", `Expected a value or a reference, got: ${JSON.stringify(value)}`);
                continue;
            }
            const token = readToken(tokenCtx, () => new DimensionToken(this.#parseDimension(value)));
            if (token !== undefined) {
                children.set(name, token);
            }
        }
        return new TokenGroup({ children });
    }

    #parseComponents(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (!isJsonObject(value)) {
                ctx.enter(name).report("invalid-value", `Expected a component object, got: ${JSON.stringify(value)}`);
                continue;
            }
            children.set(name, this.#parseComponent(value as JsonObject, ctx.enter(name)));
        }
        return new TokenGroup({ children });
    }

    #parseComponent(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [propName, propValue] of Object.entries(raw)) {
            const propCtx = ctx.enter(propName);
            const propType = COMPONENT_PROPERTY_TYPES[propName];

            if (propType === undefined) {
                const ref = TokenReference.parse(propValue);
                if (ref !== undefined) {
                    children.set(propName, new AliasToken(ref));
                }
                // A literal under an unknown property is dropped rather than
                // rejected: the document stays usable, and
                // `#reportIgnoredValues` warns about what was left out.
                continue;
            }

            const token = readToken(propCtx, () => this.#parseComponentProperty(propValue, propType));
            if (token !== undefined) {
                children.set(propName, token);
            }
        }
        return new TokenGroup({ children });
    }

    #parseComponentProperty(value: JsonValue, propType: ComponentPropertyType): TokenNode<unknown> {
        const ref = TokenReference.parse(value);
        if (ref !== undefined) {
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
        throw new DesignMdReaderError(
            "invalid-value",
            `Unexpected value for component property of type "${propType}": ${JSON.stringify(value)}`,
        );
    }

    #parseTypographyValue(raw: JsonObject): TypographyValue {
        const fontFamily = this.#parseFontFamilyOrRef(raw["fontFamily"]);
        const fontSize = this.#parseDimensionOrRef(raw["fontSize"]);
        const fontWeight = this.#parseFontWeightOrRef(raw["fontWeight"]);
        // DESIGN.md allows omitting letterSpacing; DTCG typography requires it.
        const letterSpacing = raw["letterSpacing"] === undefined
            ? new DimensionValue(0, "px")
            : this.#parseDimensionOrRef(raw["letterSpacing"]);
        const lineHeight = this.#parseLineHeight(raw["lineHeight"], fontSize);
        return new TypographyValue(fontFamily, fontSize, fontWeight, letterSpacing, lineHeight);
    }

    /**
     * Reads lineHeight, which DESIGN.md may give as a dimension while the model
     * holds a multiplier of fontSize.
     */
    #parseLineHeight(raw: unknown, fontSize: DimensionValue | TokenReference): number | TokenReference {
        if (typeof raw !== "string" || !DIMENSION_RE.test(raw)) return this.#parseNumberOrRef(raw);

        const lineHeight = this.#parseDimension(raw);
        // "em" is already relative to fontSize; the model unit type omits it.
        if ((lineHeight.unit as string) === "em") return lineHeight.value;
        if (!(fontSize instanceof DimensionValue)) {
            throw new DesignMdReaderError(
                "invalid-line-height",
                `Cannot convert lineHeight "${raw}" to a multiplier: fontSize is a reference.`,
            );
        }
        if (fontSize.unit !== lineHeight.unit || fontSize.value === 0) {
            throw new DesignMdReaderError(
                "invalid-line-height",
                `Cannot convert lineHeight "${raw}" to a multiplier of fontSize "${fontSize.value}${fontSize.unit}". `
                + "Use a unitless number or the fontSize unit.",
            );
        }
        return round(lineHeight.value / fontSize.value);
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
                [round(r / 255), round(g / 255), round(b / 255)],
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
                    round(parseInt(rgbMatch[1], 10) / 255),
                    round(parseInt(rgbMatch[2], 10) / 255),
                    round(parseInt(rgbMatch[3], 10) / 255),
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

        throw new DesignMdReaderError("invalid-color", `Unable to parse color value: "${value}"`);
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
            alpha = round(parseInt(hex[3] + hex[3], 16) / 255);
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
            alpha = round(parseInt(hex.slice(6, 8), 16) / 255);
            hex6 = hex.slice(0, 6);
        }

        return new ColorValue(
            "srgb",
            [round(r / 255), round(g / 255), round(b / 255)],
            alpha,
            `#${hex6}`,
        );
    }

    #parseDimension(value: string): DimensionValue {
        const match = value.match(DIMENSION_RE);
        if (!match) {
            throw new DesignMdReaderError(
                "invalid-dimension",
                `Expected dimension with px/em/rem unit, got: "${value}"`,
            );
        }
        return new DimensionValue(Number(match[1]), match[2] as DimensionUnit);
    }

    #parseFontFamilyOrRef(raw: unknown): string | string[] | TokenReference {
        if (typeof raw === "string") {
            const ref = TokenReference.parse(raw);
            if (ref !== undefined) return ref;
            return raw;
        }
        if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) return raw as string[];
        throw new DesignMdReaderError(
            "invalid-font-family",
            `Expected fontFamily string or array, got: ${JSON.stringify(raw)}`,
        );
    }

    #parseDimensionOrRef(raw: unknown): DimensionValue | TokenReference {
        if (typeof raw === "string") {
            const ref = TokenReference.parse(raw);
            if (ref !== undefined) return ref;
            return this.#parseDimension(raw);
        }
        throw new DesignMdReaderError("invalid-dimension", `Expected dimension string, got: ${JSON.stringify(raw)}`);
    }

    #parseFontWeightOrRef(raw: unknown): FontWeightOrReference {
        if (typeof raw === "string") {
            const ref = TokenReference.parse(raw);
            if (ref !== undefined) return ref;
            return raw as FontWeightOrReference;
        }
        if (typeof raw === "number") return raw;
        throw new DesignMdReaderError(
            "invalid-font-weight",
            `Expected fontWeight string or number, got: ${JSON.stringify(raw)}`,
        );
    }

    #parseNumberOrRef(raw: unknown): number | TokenReference {
        const ref = TokenReference.parse(raw);
        if (ref !== undefined) return ref;
        if (typeof raw === "number") return raw;
        throw new DesignMdReaderError("invalid-number", `Expected number, got: ${JSON.stringify(raw)}`);
    }

    #rgbToHex(r: number, g: number, b: number): string {
        const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

/**
 * Thrown when the DESIGN.md content does not conform to the expected format.
 */
export class DesignMdReaderError extends TokenReadError {
    constructor(id: string, message: string) {
        super(id, message);
        this.name = "DesignMdReaderError";
    }
}

const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|em|rem)$/;
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
 * Splits DESIGN.md content into its YAML frontmatter and the prose after it.
 *
 * Parsed here rather than with a markdown library: the format needs only the
 * fenced frontmatter, and a dependency-free reader runs in a browser bundle.
 */
function extractFrontmatter(content: string): { yaml: string; body: string } | undefined {
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
    const openingIndex = lines.findIndex((line) => line.trim() !== "");
    if (openingIndex < 0 || !/^---[ \t]*$/.test(lines[openingIndex])) return undefined;

    const closingOffset = lines.slice(openingIndex + 1)
        .findIndex((line) => /^---[ \t]*$/.test(line));
    if (closingOffset < 0) return undefined;
    const closingIndex = openingIndex + closingOffset + 1;
    return {
        yaml: lines.slice(openingIndex + 1, closingIndex).join("\n"),
        body: lines.slice(closingIndex + 1).join("\n"),
    };
}

/**
 * Reports whether the prose holds a markdown heading, ATX or setext.
 *
 * Headings inside a code fence do not count - they are an example, not a
 * section - so fences are tracked while scanning.
 */
function hasMarkdownHeading(body: string): boolean {
    let fence: string | undefined;
    let paragraphLine = false;
    for (const line of body.split(/\r?\n/)) {
        const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence !== undefined) {
            // A closing fence repeats the opening marker, at least as long, without an info string.
            if (fenceMatch !== null && fenceMatch[1][0] === fence[0]
                && fenceMatch[1].length >= fence.length && fenceMatch[2].trim() === "") {
                fence = undefined;
            }
            continue;
        }
        if (fenceMatch !== null) {
            fence = fenceMatch[1];
            paragraphLine = false;
            continue;
        }
        if (/^ {0,3}#{1,6}\s+\S/.test(line)) return true;
        if (paragraphLine && /^ {0,3}(?:=+|-+)[ \t]*$/.test(line)) return true;
        paragraphLine = line.trim() !== "";
    }
    return false;
}
