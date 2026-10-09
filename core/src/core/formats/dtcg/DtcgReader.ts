
import { Dtcg } from "#/core/model/Dtcg";
import { IssueCollector } from "#/core/formats/support/IssueCollector";
import { ReadContext, readToken } from "#/core/formats/support/ReadContext";
import { TokenReadError } from "#/core/formats/support/TokenReadError";
import { noSchemaValidator, type SchemaValidator } from "#/core/formats/support/SchemaValidator";
import { readDocuments, readFailed, type ReadResult, type TokenReader } from "#/core/formats/TokenReader";
import { isJsonObject } from "#/core/formats/support/Json";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { TokenType } from "#/core/model/TokenType";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { CubicBezierToken } from "#/core/model/tokens/CubicBezierToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { DurationToken } from "#/core/model/tokens/DurationToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { StrokeStyleToken } from "#/core/model/tokens/StrokeStyleToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue, ColorSpace } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue, DimensionUnit } from "#/core/model/values/DimensionValue";
import { DurationValue, DurationUnit } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject, LineCap, StrokeStyleValue } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue, FontFamilyValue, FontWeightValue } from "#/core/model/values/TypographyValue";

type JsonObject = Record<string, unknown>;

const GROUP_KEYS = new Set(["$type", "$description", "$extensions", "$deprecated", "$extends", "$root", "$schema"]);

/**
 * The schema entry point to validate against.
 *
 * Both built-in schemas keep the DTCG {@code $id}s, including the
 * DESIGN.md variant, so one id serves them all. A schema for a different DTCG
 * version would need its own id.
 */
export const DTCG_FORMAT_SCHEMA_ID = "https://www.designtokens.org/schemas/2025.10/format.json";


/**
 * Parses a DTCG 2025.10 JSON document into a {@link Dtcg}.
 *
 * A child object is treated as a token when it contains `$value` or `$ref`,
 * and as a group otherwise.
 *
 * @see https://tr.designtokens.org/format/
 */
export class DtcgReader implements TokenReader {
    readonly #schema: SchemaValidator;

    /**
     * Builds a reader for a schema already in memory.
     *
     * Prefer {@link create}, which loads the schema this format ships. Pass a validator here when the schema is embedded rather than on
     * disk, as the browser entry does, or call {@link noSchema} to read
     * without one.
     *
     * @param schema - Validator for the DTCG JSON Schema.
     */
    constructor(schema: SchemaValidator) {
        this.#schema = schema;
    }

    /**
     * Creates a reader that validates against this format's JSON Schema.
     *
     * The schema is read from disk once, here, which is what lets {@link read}
     * stay synchronous afterwards.
     *
     * @param schema - A built-in schema name, {@code "2025.10"} by default, or
     *   a path to a schema of your own.
     */
    static async create(schema?: string): Promise<DtcgReader> {
        // Imported on call. The module that loads schemas imports this one, so
        // a static import would close the cycle, and it reaches the file
        // system, which a browser bundle importing this reader must not.
        const { dtcgSchemaValidator } = await import("#/core/formats/dtcg/dtcgSchema");
        return new DtcgReader(await dtcgSchemaValidator(schema));
    }

    /**
     * Creates a reader that checks the token model but no JSON Schema.
     *
     * For an environment that cannot load one: the Figma plugin bundle has no
     * file system, and reads back only the DTCG it generated itself. The
     * browser entry uses this for model parsing, having already run the schema
     * stage against its embedded schemas.
     *
     * Document structure goes unchecked - an unknown key or a `$description`
     * that is not a string passes, where the schema would reject it.
     */
    static noSchema(): DtcgReader {
        return new DtcgReader(noSchemaValidator);
    }


    /**
     * Reads a DTCG JSON document.
     *
     * Runs in stages, each gating the next: syntax, then the token model, then
     * the JSON Schema. The model comes before the schema because it knows what
     * it was reading and names the token that failed, where the schema reports
     * a pattern that did not match.
     *
     * Diagnostics carry the path of the offending token rather than a line
     * number: {@code JSON.parse} does not report positions, and for DTCG the
     * token path locates the problem better anyway.
     */
    read(content: string, sourceId?: string): ReadResult {
        const collector = new IssueCollector(sourceId);

        let raw: unknown;
        try {
            raw = JSON.parse(content);
        } catch (error) {
            collector.add("json-syntax", error instanceof Error ? error.message : String(error));
            return readFailed(collector.issues);
        }

        if (!isJsonObject(raw)) {
            collector.add("invalid-root", "JSON root must be an object.");
            return readFailed(collector.issues);
        }

        const document = new Dtcg(this.#parseGroup(raw, undefined, new ReadContext(collector)), sourceId);
        if (collector.failed) {
            return readFailed(collector.issues);
        }

        this.#schema.validate(addInheritedTokenTypes(raw), collector);

        return collector.failed ? readFailed(collector.issues) : readDocuments([document], collector.issues);
    }

    #parseGroup(raw: JsonObject, inheritedType: TokenType | undefined, ctx: ReadContext): TokenGroup {
        const type = this.#resolveType(raw["$type"], inheritedType);
        const description = typeof raw["$description"] === "string" ? raw["$description"] : undefined;
        const deprecated = this.#parseDeprecated(raw["$deprecated"]);
        const extensions = this.#parseExtensions(raw["$extensions"]);
        const extendsRef = this.#parseExtendsRef(raw["$extends"]);
        const root = raw["$root"] != null
            ? readToken(ctx.enter("$root"), () => this.#parseToken(raw["$root"] as JsonObject, type))
            : undefined;

        const children = new Map<string, TokenGroup | TokenNode<unknown>>();

        for (const [key, value] of Object.entries(raw)) {
            if (GROUP_KEYS.has(key)) continue;
            if (typeof value !== "object" || value === null || Array.isArray(value)) continue;

            const child = value as JsonObject;
            if (this.#isToken(child)) {
                const token = readToken(ctx.enter(key), () => this.#parseToken(child, type));
                if (token !== undefined) {
                    children.set(key, token);
                }
            } else {
                children.set(key, this.#parseGroup(child, type, ctx.enter(key)));
            }
        }

        return new TokenGroup({ type, description, deprecated, extensions, extends: extendsRef, root, children });
    }

    #isToken(raw: JsonObject): boolean {
        return "$value" in raw || "$ref" in raw;
    }

    #parseToken(raw: JsonObject, inheritedType: TokenType | undefined): TokenNode<unknown> {
        const type = this.#resolveType(raw["$type"], inheritedType);
        const description = typeof raw["$description"] === "string" ? raw["$description"] : undefined;
        const deprecated = this.#parseDeprecated(raw["$deprecated"]);
        const extensions = this.#parseExtensions(raw["$extensions"]);

        if ("$ref" in raw) {
            const ref = raw["$ref"];
            if (typeof ref !== "string") throw new DtcgReaderError("invalid-reference", "$ref must be a string");
            return this.#makeToken(type, new TokenReference(ref), description, deprecated, extensions);
        }

        const rawValue = raw["$value"];

        const valueRef = TokenReference.parse(rawValue);
        if (valueRef !== undefined) {
            return this.#makeToken(type, valueRef, description, deprecated, extensions);
        }

        if (type == null) {
            throw new DtcgReaderError(
                "missing-token-type",
                `Token has no $type and no inherited type: ${JSON.stringify(raw)}`,
            );
        }

        const value = this.#parseValue(type, rawValue);
        return this.#makeToken(type, value, description, deprecated, extensions);
    }

    #makeToken(
        type: TokenType | undefined,
        value: unknown,
        description: string | undefined,
        deprecated: boolean | string | undefined,
        extensions: Record<string, unknown> | undefined,
    ): TokenNode<unknown> {
        switch (type) {
            case "color": return new ColorToken(value as ConstructorParameters<typeof ColorToken>[0], description, deprecated, extensions);
            case "dimension": return new DimensionToken(value as ConstructorParameters<typeof DimensionToken>[0], description, deprecated, extensions);
            case "fontFamily": return new FontFamilyToken(value as ConstructorParameters<typeof FontFamilyToken>[0], description, deprecated, extensions);
            case "fontWeight": return new FontWeightToken(value as ConstructorParameters<typeof FontWeightToken>[0], description, deprecated, extensions);
            case "number": return new NumberToken(value as ConstructorParameters<typeof NumberToken>[0], description, deprecated, extensions);
            case "duration": return new DurationToken(value as ConstructorParameters<typeof DurationToken>[0], description, deprecated, extensions);
            case "cubicBezier": return new CubicBezierToken(value as ConstructorParameters<typeof CubicBezierToken>[0], description, deprecated, extensions);
            case "strokeStyle": return new StrokeStyleToken(value as ConstructorParameters<typeof StrokeStyleToken>[0], description, deprecated, extensions);
            case "border": return new BorderToken(value as ConstructorParameters<typeof BorderToken>[0], description, deprecated, extensions);
            case "transition": return new TransitionToken(value as ConstructorParameters<typeof TransitionToken>[0], description, deprecated, extensions);
            case "shadow": return new ShadowToken(value as ConstructorParameters<typeof ShadowToken>[0], description, deprecated, extensions);
            case "gradient": return new GradientToken(value as ConstructorParameters<typeof GradientToken>[0], description, deprecated, extensions);
            case "typography": return new TypographyToken(value as ConstructorParameters<typeof TypographyToken>[0], description, deprecated, extensions);
            case undefined: return new AliasToken(value as TokenReference, description, deprecated, extensions);
            default: throw new DtcgReaderError("unknown-token-type", `Unknown token type: ${String(type)}`);
        }
    }

    #parseValue(type: TokenType, raw: unknown): unknown {
        switch (type) {
            case "color": return this.#parseColor(raw);
            case "dimension": return this.#parseDimension(raw);
            case "fontFamily": return this.#parseFontFamily(raw);
            case "fontWeight": return this.#parseFontWeight(raw);
            case "number": return this.#parseNumber(raw);
            case "duration": return this.#parseDuration(raw);
            case "cubicBezier": return this.#parseCubicBezier(raw);
            case "strokeStyle": return this.#parseStrokeStyle(raw);
            case "border": return this.#parseBorder(raw);
            case "transition": return this.#parseTransition(raw);
            case "shadow": return this.#parseShadow(raw);
            case "gradient": return this.#parseGradient(raw);
            case "typography": return this.#parseTypography(raw);
        }
    }

    #parseColor(raw: unknown): ColorValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-color", `Invalid color value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        const colorSpace = obj["colorSpace"] as ColorSpace;
        const components = obj["components"] as (number | "none")[];
        const alpha = typeof obj["alpha"] === "number" ? obj["alpha"] : 1;
        const hex = typeof obj["hex"] === "string" ? obj["hex"] : undefined;
        return new ColorValue(colorSpace, components, alpha, hex);
    }

    #parseDimension(raw: unknown): DimensionValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-dimension", `Invalid dimension value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new DimensionValue(obj["value"] as number, obj["unit"] as DimensionUnit);
    }

    #parseFontFamily(raw: unknown): FontFamilyValue {
        if (typeof raw === "string") return raw;
        if (Array.isArray(raw)) return raw as string[];
        throw new DtcgReaderError("invalid-font-family", `Invalid fontFamily value: ${JSON.stringify(raw)}`);
    }

    #parseFontWeight(raw: unknown): FontWeightValue {
        if (typeof raw === "number" || typeof raw === "string") return raw as FontWeightValue;
        throw new DtcgReaderError("invalid-font-weight", `Invalid fontWeight value: ${JSON.stringify(raw)}`);
    }

    #parseNumber(raw: unknown): number {
        if (typeof raw !== "number") {
            throw new DtcgReaderError("invalid-number", `Invalid number value: ${JSON.stringify(raw)}`);
        }
        return raw;
    }

    #parseDuration(raw: unknown): DurationValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-duration", `Invalid duration value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new DurationValue(obj["value"] as number, obj["unit"] as DurationUnit);
    }

    #parseCubicBezier(raw: unknown): CubicBezierValue {
        if (!Array.isArray(raw) || raw.length !== 4) {
            throw new DtcgReaderError("invalid-cubic-bezier", `Invalid cubicBezier value: ${JSON.stringify(raw)}`);
        }
        return new CubicBezierValue(raw[0] as number, raw[1] as number, raw[2] as number, raw[3] as number);
    }

    #parseStrokeStyle(raw: unknown): StrokeStyleValue {
        if (typeof raw === "string") return raw as StrokeStyleValue;
        if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            const obj = raw as JsonObject;
            const dashArray = (obj["dashArray"] as unknown[]).map(d => this.#parseDimension(d));
            return new StrokeStyleObject(dashArray, obj["lineCap"] as LineCap);
        }
        throw new DtcgReaderError("invalid-stroke-style", `Invalid strokeStyle value: ${JSON.stringify(raw)}`);
    }

    #parseBorder(raw: unknown): BorderValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-border", `Invalid border value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        const color = this.#parseColorOrRef(obj["color"]);
        const width = this.#parseDimensionOrRef(obj["width"]);
        const style = this.#parseStrokeStyleOrRef(obj["style"]);
        return new BorderValue(color, width, style);
    }

    #parseTransition(raw: unknown): TransitionValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-transition", `Invalid transition value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        const duration = this.#parseDurationOrRef(obj["duration"]);
        const delay = this.#parseDurationOrRef(obj["delay"]);
        const timingFunction = this.#parseCubicBezierOrRef(obj["timingFunction"]);
        return new TransitionValue(duration, delay, timingFunction);
    }

    #parseShadow(raw: unknown): ShadowLayer | (ShadowLayer | TokenReference)[] {
        if (Array.isArray(raw)) {
            return raw.map(item => this.#parseShadowLayerOrRef(item));
        }
        return this.#parseShadowLayer(raw);
    }

    #parseShadowLayer(raw: unknown): ShadowLayer {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-shadow", `Invalid shadow layer: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new ShadowLayer(
            this.#parseColorOrRef(obj["color"]),
            this.#parseDimensionOrRef(obj["offsetX"]),
            this.#parseDimensionOrRef(obj["offsetY"]),
            this.#parseDimensionOrRef(obj["blur"]),
            this.#parseDimensionOrRef(obj["spread"]),
            typeof obj["inset"] === "boolean" ? obj["inset"] : false,
        );
    }

    #parseShadowLayerOrRef(raw: unknown): ShadowLayer | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseShadowLayer(raw);
    }

    #parseGradient(raw: unknown): (GradientStop | TokenReference)[] {
        if (!Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-gradient", `Invalid gradient value: ${JSON.stringify(raw)}`);
        }
        return raw.map(item => this.#parseGradientStopOrRef(item));
    }

    #parseGradientStopOrRef(raw: unknown): GradientStop | TokenReference {
        const ref = TokenReference.parse(raw);
        if (ref !== undefined) return ref;
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-gradient", `Invalid gradient stop: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new GradientStop(
            this.#parseColorOrRef(obj["color"]),
            this.#parseNumberOrRef(obj["position"]),
        );
    }

    #parseTypography(raw: unknown): TypographyValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgReaderError("invalid-typography", `Invalid typography value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new TypographyValue(
            this.#parseFontFamilyOrRef(obj["fontFamily"]),
            this.#parseDimensionOrRef(obj["fontSize"]),
            this.#parseFontWeightOrRef(obj["fontWeight"]),
            this.#parseDimensionOrRef(obj["letterSpacing"]),
            this.#parseNumberOrRef(obj["lineHeight"]),
        );
    }

    #parseColorOrRef(raw: unknown): ColorValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseColor(raw);
    }

    #parseDimensionOrRef(raw: unknown): DimensionValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseDimension(raw);
    }

    #parseDurationOrRef(raw: unknown): DurationValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseDuration(raw);
    }

    #parseCubicBezierOrRef(raw: unknown): CubicBezierValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseCubicBezier(raw);
    }

    #parseStrokeStyleOrRef(raw: unknown): StrokeStyleValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseStrokeStyle(raw);
    }

    #parseFontFamilyOrRef(raw: unknown): FontFamilyValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseFontFamily(raw);
    }

    #parseFontWeightOrRef(raw: unknown): FontWeightValue | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseFontWeight(raw);
    }

    #parseNumberOrRef(raw: unknown): number | TokenReference {
        return TokenReference.parse(raw) ?? this.#parseNumber(raw);
    }

    #resolveType(raw: unknown, inherited: TokenType | undefined): TokenType | undefined {
        if (typeof raw === "string") return raw as TokenType;
        return inherited;
    }

    #parseDeprecated(raw: unknown): boolean | string | undefined {
        if (typeof raw === "boolean" || typeof raw === "string") return raw;
        return undefined;
    }

    #parseExtensions(raw: unknown): Record<string, unknown> | undefined {
        if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            return raw as Record<string, unknown>;
        }
        return undefined;
    }

    #parseExtendsRef(raw: unknown): TokenReference | string | undefined {
        if (typeof raw !== "string") return undefined;
        return TokenReference.parse(raw) ?? raw;
    }
}

/**
 * Thrown when the input JSON does not conform to the expected DTCG structure.
 */
export class DtcgReaderError extends TokenReadError {
    constructor(id: string, message: string) {
        super(id, message);
        this.name = "DtcgReaderError";
    }
}

/**
 * Copies group-level `$type` values onto descendant tokens for schema validation.
 *
 * The DTCG schema validates token values through a type-specific union, while
 * the format allows a token to inherit `$type` from its nearest group. AJV
 * cannot resolve that inheritance itself, so validation uses this copy only.
 */
function addInheritedTokenTypes(value: unknown, inheritedType?: string): unknown {
    if (!isJsonObject(value)) return value;

    const effectiveType = resolveEffectiveType(value, inheritedType);
    if (isTokenObject(value)) {
        if (value["$type"] !== undefined || effectiveType === undefined) return value;
        return { ...value, "$type": effectiveType };
    }

    const normalized: JsonObject = { ...value };
    const root = value["$root"];
    if (isJsonObject(root)) {
        normalized["$root"] = addInheritedTokenTypes(root, effectiveType);
    }

    for (const [key, child] of Object.entries(value)) {
        if (key.startsWith("$") || key === "$root") continue;
        if (isJsonObject(child)) {
            normalized[key] = addInheritedTokenTypes(child, effectiveType);
        }
    }

    return normalized;
}

function resolveEffectiveType(value: JsonObject, inheritedType: string | undefined): string | undefined {
    if (!("$type" in value)) return inheritedType;
    return typeof value["$type"] === "string" ? value["$type"] : undefined;
}

function isTokenObject(value: JsonObject): boolean {
    return "$value" in value || "$ref" in value;
}
