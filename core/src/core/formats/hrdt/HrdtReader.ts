import { parseAllDocuments, LineCounter, type Document } from "yaml";
import { Dtcg } from "#/core/model/Dtcg";
import { IssueCollector } from "#/core/formats/support/IssueCollector";
import { ReadContext, readToken } from "#/core/formats/support/ReadContext";
import { TokenReadError } from "#/core/formats/support/TokenReadError";
import { noSchemaValidator, type SchemaValidator } from "#/core/formats/support/SchemaValidator";
import { readDocuments, readFailed, type ReadResult, type TokenReader } from "#/core/formats/TokenReader";
import { YamlLocator } from "#/core/formats/hrdt/YamlLocator";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { isJsonObject, round, type JsonObject, type JsonValue } from "#/core/formats/support/Json";
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
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject, StrokeStyleValue } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { FontWeightValue, TypographyValue } from "#/core/model/values/TypographyValue";


const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|rem|em)$/;
const DURATION_RE = /^(-?\d+(?:\.\d+)?)(ms|s)$/;
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const HRDT_SCHEMA_ID = "https://designtokens.local/schemas/hrdt-tokens.json";



const TOKEN_TYPES = new Set<string>([
    "color", "dimension", "fontFamily", "fontWeight", "duration",
    "cubicBezier", "number", "strokeStyle", "border", "transition",
    "shadow", "gradient", "typography",
]);

/**
 * Reads an HRDT token file and parses it directly into a {@link Dtcg} model.
 *
 * The HRDT format uses YAML syntax and group path to infer token types
 * (e.g. `primitive.color.*` -> color tokens). Non-primitive groups
 * contain alias references to primitive tokens.
 */
export class HrdtReader implements TokenReader {
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
    static async create(): Promise<HrdtReader> {
        // Imported on call. The module that loads schemas imports this one, so
        // a static import would close the cycle, and it reaches the file
        // system, which a browser bundle importing this reader must not.
        const { hrdtSchemaValidator } = await import("#/core/formats/hrdt/hrdtSchema");
        return new HrdtReader(await hrdtSchemaValidator());
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
    static noSchema(): HrdtReader {
        return new HrdtReader(noSchemaValidator);
    }


    /**
     * Reads HRDT content, which may hold several YAML documents separated by
     * {@code ---}.
     *
     * Runs in stages, each gating the next: syntax, then the token model, then
     * the JSON Schema. A stage that fails stops the ones after it, because
     * reading tokens out of a source known to be malformed reports problems the
     * author does not have.
     *
     * The model comes before the schema deliberately. Both reject the same bad
     * values, but the model knows what it was reading: it says
     * {@code Expected hex color, got: "#GGG"} and points at the line, where the
     * schema would say the value must match a pattern and name neither the
     * token nor its position. The schema runs last and catches what the model
     * cannot see, such as an unknown group of primitives.
     *
     * Within a stage every problem is reported, so one read tells the author
     * everything that needs fixing.
     */
    read(content: string, sourceId?: string): ReadResult {
        const lineCounter = new LineCounter();
        const documents = parseAllDocuments(content, { lineCounter });
        const collector = new IssueCollector(sourceId);

        const locators = documents.map((doc) => new YamlLocator(doc, lineCounter));

        documents.forEach((doc, index) => this.#readSyntax(doc, locators[index], collector));
        if (collector.failed) {
            return readFailed(collector.issues);
        }

        const parsed = documents.map((doc, index) => this.#readDocument(doc, locators[index], collector, sourceId));
        if (collector.failed) {
            return readFailed(collector.issues);
        }

        for (const doc of documents) {
            this.#schema.validate(doc.toJS() as unknown, collector);
        }

        return collector.failed ? readFailed(collector.issues) : readDocuments(parsed, collector.issues);
    }

    /**
     * Reports the YAML errors of one document, and whether its root is usable.
     */
    #readSyntax(doc: Document, locator: YamlLocator, collector: IssueCollector): void {
        for (const error of doc.errors) {
            collector.add(yamlIssueId(error.code), error.message, { position: locator.at(error.pos[0]) });
        }
        if (doc.errors.length === 0 && !isJsonObject(doc.toJS() as unknown)) {
            collector.add("invalid-root", "YAML root must be an object.", { position: locator.ofRoot() });
        }
    }

    /**
     * Builds the model of one document, reporting each token that fails.
     */
    #readDocument(doc: Document, locator: YamlLocator, collector: IssueCollector, sourceId?: string): Dtcg {
        const raw = doc.toJS() as JsonObject;
        return new Dtcg(this.#parseRoot(raw, new ReadContext(collector, locator)), sourceId);
    }

    #parseRoot(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            if (key === "$schema") continue;
            if (!isJsonObject(value)) continue;
            if (key === "primitive") {
                children.set(key, this.#parsePrimitiveRoot(value as JsonObject, ctx.enter(key)));
            } else {
                children.set(key, this.#parseReferenceGroup(value as JsonObject, ctx.enter(key)));
            }
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveRoot(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [typeName, tokens] of Object.entries(raw)) {
            if (!TOKEN_TYPES.has(typeName)) {
                ctx.enter(typeName).report("unknown-token-type", `Unknown primitive token type: "${typeName}"`);
                continue;
            }
            const tokenType = typeName as TokenType;
            children.set(typeName, this.#parsePrimitiveTypeGroup(tokens as JsonObject, tokenType, ctx.enter(typeName)));
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveTypeGroup(raw: JsonObject, tokenType: TokenType, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            // Colors nest into palettes - `brand: {500: "#..."}` - where every
            // other primitive type holds its tokens flat.
            if (tokenType === "color" && isJsonObject(value)) {
                children.set(name, this.#parsePrimitiveTypeGroup(value, tokenType, ctx.enter(name)));
                continue;
            }
            const token = readToken(ctx.enter(name), () => this.#parsePrimitiveToken(value, tokenType));
            if (token !== undefined) {
                children.set(name, token);
            }
        }
        return new TokenGroup({ type: tokenType, children });
    }

    #parsePrimitiveToken(value: JsonValue, tokenType: TokenType): TokenNode<unknown> {
        const ref = TokenReference.parse(value);
        if (ref !== undefined) {
            return new AliasToken(ref);
        }
        switch (tokenType) {
            case "color": return new ColorToken(this.#parseColor(value));
            case "dimension": return new DimensionToken(this.#parseDimension(value));
            case "fontFamily": return new FontFamilyToken(this.#parseFontFamily(value));
            case "fontWeight": return new FontWeightToken(this.#parseFontWeight(value));
            case "number": return new NumberToken(this.#parseNumber(value));
            case "duration": return new DurationToken(this.#parseDuration(value));
            case "cubicBezier": return new CubicBezierToken(this.#parseCubicBezier(value));
            case "strokeStyle": return new StrokeStyleToken(this.#parseStrokeStyle(value));
            case "border": return new BorderToken(this.#parseBorder(value));
            case "transition": return new TransitionToken(this.#parseTransition(value));
            case "shadow": return new ShadowToken(this.#parseShadow(value));
            case "gradient": return new GradientToken(this.#parseGradient(value));
            case "typography": return new TypographyToken(this.#parseTypography(value));
        }
    }

    #parseReferenceGroup(raw: JsonObject, ctx: ReadContext): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            if (this.#isLeaf(value)) {
                const token = readToken(ctx.enter(key), () => this.#parseReferenceToken(value));
                if (token !== undefined) {
                    children.set(key, token);
                }
            } else {
                children.set(key, this.#parseReferenceGroup(value as JsonObject, ctx.enter(key)));
            }
        }
        return new TokenGroup({ children });
    }

    #isLeaf(value: JsonValue): boolean {
        return !isJsonObject(value) || Array.isArray(value);
    }

    #parseReferenceToken(value: JsonValue): TokenNode<unknown> {
        const ref = TokenReference.parse(value);
        return ref !== undefined ? new AliasToken(ref) : this.#autoDetectToken(value);
    }

    /**
     * When a non-reference value appears outside the {@code primitive}
     * group (e.g. during cross-format roundtrips), infer its type from
     * the value pattern.
     */
    #autoDetectToken(value: JsonValue): TokenNode<unknown> {
        if (typeof value === "string") {
            if (HEX_RE.test(value)) return new ColorToken(this.#parseColor(value));
            if (DIMENSION_RE.test(value)) return new DimensionToken(this.#parseDimension(value));
            if (DURATION_RE.test(value)) return new DurationToken(this.#parseDuration(value));
            return new FontFamilyToken(value);
        }
        if (typeof value === "number") return new NumberToken(value);
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
            return new FontFamilyToken(value as string[]);
        }
        throw new HrdtReaderError(
            "invalid-reference",
            `Expected a reference in non-primitive group, got: ${JSON.stringify(value)}`,
        );
    }

    #parseColor(value: JsonValue): ColorValue {
        if (typeof value !== "string" || !HEX_RE.test(value)) {
            throw new HrdtReaderError("invalid-color", `Expected hex color, got: ${JSON.stringify(value)}`);
        }
        const normalized = value.toLowerCase();
        const hex = normalized.slice(0, 7);
        const r = parseInt(normalized.slice(1, 3), 16);
        const g = parseInt(normalized.slice(3, 5), 16);
        const b = parseInt(normalized.slice(5, 7), 16);
        const alpha = normalized.length === 9
            ? round(parseInt(normalized.slice(7, 9), 16) / 255)
            : 1;
        return new ColorValue(
            "srgb",
            [round(r / 255), round(g / 255), round(b / 255)],
            alpha,
            hex,
        );
    }

    #parseDimension(value: JsonValue): DimensionValue {
        if (typeof value !== "string") {
            throw new HrdtReaderError("invalid-dimension", `Expected dimension string, got: ${JSON.stringify(value)}`);
        }
        const match = value.match(DIMENSION_RE);
        if (!match) {
            throw new HrdtReaderError("invalid-dimension", `Expected dimension with px/rem unit, got: "${value}"`);
        }
        return new DimensionValue(Number(match[1]), match[2] as "px" | "rem");
    }

    #parseFontFamily(value: JsonValue): string | string[] {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
        throw new HrdtReaderError(
            "invalid-font-family",
            `Expected fontFamily string or array, got: ${JSON.stringify(value)}`,
        );
    }

    #parseFontWeight(value: JsonValue): FontWeightValue {
        if (typeof value === "string" || typeof value === "number") return value as FontWeightValue;
        throw new HrdtReaderError(
            "invalid-font-weight",
            `Expected fontWeight string or number, got: ${JSON.stringify(value)}`,
        );
    }

    #parseNumber(value: JsonValue): number {
        if (typeof value !== "number") {
            throw new HrdtReaderError("invalid-number", `Expected number, got: ${JSON.stringify(value)}`);
        }
        return value;
    }

    #parseDuration(value: JsonValue): DurationValue {
        if (typeof value !== "string") {
            throw new HrdtReaderError("invalid-duration", `Expected duration string, got: ${JSON.stringify(value)}`);
        }
        const match = value.match(DURATION_RE);
        if (!match) {
            throw new HrdtReaderError("invalid-duration", `Expected duration with ms/s unit, got: "${value}"`);
        }
        return new DurationValue(Number(match[1]), match[2] as "ms" | "s");
    }

    #parseCubicBezier(value: JsonValue): CubicBezierValue {
        if (!Array.isArray(value) || value.length !== 4 || !value.every((v) => typeof v === "number")) {
            throw new HrdtReaderError(
                "invalid-cubic-bezier",
                `Expected cubicBezier [n, n, n, n], got: ${JSON.stringify(value)}`,
            );
        }
        return new CubicBezierValue(value[0] as number, value[1] as number, value[2] as number, value[3] as number);
    }

    #parseStrokeStyle(value: JsonValue): StrokeStyleValue {
        if (typeof value === "string") return value as StrokeStyleValue;
        if (isJsonObject(value)) {
            const obj = value as JsonObject;
            const dashArray = (obj["dashArray"] as JsonValue[]).map((d) => this.#parseDimension(d));
            return new StrokeStyleObject(dashArray, obj["lineCap"] as "round" | "butt" | "square");
        }
        throw new HrdtReaderError("invalid-stroke-style", `Expected strokeStyle, got: ${JSON.stringify(value)}`);
    }

    #parseBorder(value: JsonValue): BorderValue {
        if (!isJsonObject(value)) {
            throw new HrdtReaderError("invalid-border", `Expected border object, got: ${JSON.stringify(value)}`);
        }
        const obj = value as JsonObject;
        return new BorderValue(
            this.#parseColor(obj["color"]),
            this.#parseDimension(obj["width"]),
            this.#parseStrokeStyle(obj["style"]),
        );
    }

    #parseTransition(value: JsonValue): TransitionValue {
        if (!isJsonObject(value)) {
            throw new HrdtReaderError(
                "invalid-transition",
                `Expected transition object, got: ${JSON.stringify(value)}`,
            );
        }
        const obj = value as JsonObject;
        return new TransitionValue(
            TokenReference.parse(obj["duration"]) ?? this.#parseDuration(obj["duration"]),
            TokenReference.parse(obj["delay"]) ?? this.#parseDuration(obj["delay"]),
            TokenReference.parse(obj["timingFunction"]) ?? this.#parseCubicBezier(obj["timingFunction"]),
        );
    }

    #parseShadow(value: JsonValue): ShadowLayer | (ShadowLayer | TokenReference)[] {
        if (Array.isArray(value)) {
            return value.map((item) => TokenReference.parse(item) ?? this.#parseShadowLayer(item));
        }
        return this.#parseShadowLayer(value);
    }

    #parseShadowLayer(value: JsonValue): ShadowLayer {
        if (!isJsonObject(value)) {
            throw new HrdtReaderError("invalid-shadow", `Expected shadow layer object, got: ${JSON.stringify(value)}`);
        }
        const obj = value as JsonObject;
        return new ShadowLayer(
            this.#parseColor(obj["color"]),
            this.#parseDimension(obj["offsetX"]),
            this.#parseDimension(obj["offsetY"]),
            this.#parseDimension(obj["blur"]),
            this.#parseDimension(obj["spread"]),
        );
    }

    #parseGradient(value: JsonValue): (GradientStop | TokenReference)[] {
        if (!Array.isArray(value)) {
            throw new HrdtReaderError(
                "invalid-gradient",
                `Expected gradient stops array, got: ${JSON.stringify(value)}`,
            );
        }
        return value.map((item) => {
            const reference = TokenReference.parse(item);
            if (reference !== undefined) return reference;
            if (!isJsonObject(item)) {
                throw new HrdtReaderError(
                    "invalid-gradient",
                    `Expected gradient stop object, got: ${JSON.stringify(item)}`,
                );
            }
            const obj = item as JsonObject;
            return new GradientStop(
                TokenReference.parse(obj["color"]) ?? this.#parseColor(obj["color"]),
                TokenReference.parse(obj["position"]) ?? this.#parseNumber(obj["position"]),
            );
        });
    }

    #parseTypography(value: JsonValue): TypographyValue {
        if (!isJsonObject(value)) {
            throw new HrdtReaderError(
                "invalid-typography",
                `Expected typography object, got: ${JSON.stringify(value)}`,
            );
        }
        const obj = value as JsonObject;
        return new TypographyValue(
            this.#parseFontFamily(obj["fontFamily"]),
            this.#parseDimension(obj["fontSize"]),
            this.#parseFontWeight(obj["fontWeight"]),
            this.#parseDimension(obj["letterSpacing"]),
            this.#parseNumber(obj["lineHeight"]),
        );
    }
}

/**
 * Turns a YAML parser error code into a diagnostic id, e.g. {@code BAD_INDENT}
 * into {@code yaml-bad-indent}.
 */
function yamlIssueId(code: string | undefined): string {
    return code === undefined ? "yaml-syntax" : `yaml-${code.toLowerCase().replace(/_/g, "-")}`;
}

/**
 * Thrown when the YAML content does not conform to the HRDT token format.
 */
export class HrdtReaderError extends TokenReadError {
    constructor(id: string, message: string) {
        super(id, message);
        this.name = "HrdtReaderError";
    }
}


