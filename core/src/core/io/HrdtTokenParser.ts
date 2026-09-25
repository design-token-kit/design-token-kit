import { parse as parseYaml, parseAllDocuments, type Document } from "yaml";
import { Dtcg } from "#/core/model/Dtcg";
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
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject, StrokeStyleValue } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { FontWeightValue, TypographyValue } from "#/core/model/values/TypographyValue";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|rem|em)$/;
const DURATION_RE = /^(-?\d+(?:\.\d+)?)(ms|s)$/;
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const REFERENCE_RE = /^\{[^{}]+\}$/;
const TOKEN_TYPES = new Set<string>([
    "color", "dimension", "fontFamily", "fontWeight", "duration",
    "cubicBezier", "number", "strokeStyle", "border", "transition",
    "shadow", "gradient", "typography",
]);

/**
 * Parses HRDT token content already held by the caller.
 *
 * This parser contains no file-system dependency and can run in browsers,
 * Node.js, Figma plugins, and workers.
 */
export class HrdtTokenParser {

    parseRaw(hrdtContent: string): unknown {
        return parseYaml(hrdtContent);
    }

    parseAllRaw(hrdtContent: string): unknown[] {
        return this.#parseAllDocuments(hrdtContent).map((document) => document.toJS());
    }

    parse(hrdtContent: string, source?: string): Dtcg {
        const raw = parseYaml(hrdtContent);
        if (!this.#isObject(raw)) {
            throw new HrdtTokenReaderError("YAML root must be an object.");
        }
        return new Dtcg(this.#parseRoot(raw), source);
    }

    parseAll(hrdtContent: string, source?: string): Dtcg[] {
        const documents = this.#parseAllDocuments(hrdtContent);
        return documents.map((document) => {
            const raw = document.toJS();
            if (!this.#isObject(raw)) {
                throw new HrdtTokenReaderError("YAML document root must be an object.");
            }
            return new Dtcg(this.#parseRoot(raw), source);
        });
    }

    /**
     * Unlike {@code parse}, {@code parseAllDocuments} keeps syntax errors on
     * each document instead of throwing, so they are surfaced here.
     */
    #parseAllDocuments(hrdtContent: string): Document.Parsed[] {
        const documents = parseAllDocuments(hrdtContent);
        const error = documents.flatMap((document) => document.errors)[0];
        if (error !== undefined) {
            throw new HrdtTokenReaderError(error.message);
        }
        return documents;
    }

    #parseRoot(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            if (key === "$schema" || !this.#isObject(value)) continue;
            children.set(key, key === "primitive"
                ? this.#parsePrimitiveRoot(value)
                : this.#parseReferenceGroup(value));
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveRoot(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [typeName, tokens] of Object.entries(raw)) {
            if (!TOKEN_TYPES.has(typeName)) {
                throw new HrdtTokenReaderError(`Unknown primitive token type: "${typeName}"`);
            }
            children.set(typeName, this.#parsePrimitiveTypeGroup(tokens as JsonObject, typeName as TokenType));
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveTypeGroup(raw: JsonObject, tokenType: TokenType): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            if (tokenType === "color" && this.#isObject(value)) {
                children.set(name, this.#parsePrimitiveTypeGroup(value, tokenType));
            } else {
                children.set(name, this.#parsePrimitiveToken(value, tokenType));
            }
        }
        return new TokenGroup({ type: tokenType, children });
    }

    #parsePrimitiveToken(value: JsonValue, tokenType: TokenType): TokenNode<unknown> {
        const reference = this.#parseReference(value);
        if (reference !== undefined) return new AliasToken(reference);
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

    #parseReferenceGroup(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            children.set(key, this.#isLeaf(value)
                ? this.#parseReferenceToken(value)
                : this.#parseReferenceGroup(value as JsonObject));
        }
        return new TokenGroup({ children });
    }

    #isLeaf(value: JsonValue): boolean {
        return !this.#isObject(value) || Array.isArray(value);
    }

    #parseReferenceToken(value: JsonValue): TokenNode<unknown> {
        const reference = this.#parseReference(value);
        if (reference !== undefined) return new AliasToken(reference);
        return this.#autoDetectToken(value);
    }

    #autoDetectToken(value: JsonValue): TokenNode<unknown> {
        if (typeof value === "string") {
            if (HEX_RE.test(value)) return new ColorToken(this.#parseColor(value));
            if (DIMENSION_RE.test(value)) return new DimensionToken(this.#parseDimension(value));
            if (DURATION_RE.test(value)) return new DurationToken(this.#parseDuration(value));
            return new FontFamilyToken(value);
        }
        if (typeof value === "number") return new NumberToken(value);
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
            return new FontFamilyToken(value as string[]);
        }
        throw new HrdtTokenReaderError(`Expected a reference in non-primitive group, got: ${JSON.stringify(value)}`);
    }

    #parseColor(value: JsonValue): ColorValue {
        if (typeof value !== "string" || !HEX_RE.test(value)) {
            throw new HrdtTokenReaderError(`Expected hex color, got: ${JSON.stringify(value)}`);
        }
        const normalized = value.toLowerCase();
        const r = parseInt(normalized.slice(1, 3), 16);
        const g = parseInt(normalized.slice(3, 5), 16);
        const b = parseInt(normalized.slice(5, 7), 16);
        const alpha = normalized.length === 9 ? this.#round(parseInt(normalized.slice(7, 9), 16) / 255) : 1;
        return new ColorValue("srgb", [this.#round(r / 255), this.#round(g / 255), this.#round(b / 255)], alpha, normalized.slice(0, 7));
    }

    #parseDimension(value: JsonValue): DimensionValue {
        const match = typeof value === "string" ? value.match(DIMENSION_RE) : null;
        if (match === null) throw new HrdtTokenReaderError(`Expected dimension with px/rem unit, got: ${JSON.stringify(value)}`);
        return new DimensionValue(Number(match[1]), match[2] as "px" | "rem");
    }

    #parseFontFamily(value: JsonValue): string | string[] {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value as string[];
        throw new HrdtTokenReaderError(`Expected fontFamily string or array, got: ${JSON.stringify(value)}`);
    }

    #parseFontWeight(value: JsonValue): FontWeightValue {
        if (typeof value === "number") return value;
        if (typeof value === "string") return value as FontWeightValue;
        throw new HrdtTokenReaderError(`Expected fontWeight string or number, got: ${JSON.stringify(value)}`);
    }

    #parseNumber(value: JsonValue): number {
        if (typeof value !== "number") throw new HrdtTokenReaderError(`Expected number, got: ${JSON.stringify(value)}`);
        return value;
    }

    #parseDuration(value: JsonValue): DurationValue {
        const match = typeof value === "string" ? value.match(DURATION_RE) : null;
        if (match === null) throw new HrdtTokenReaderError(`Expected duration with ms/s unit, got: ${JSON.stringify(value)}`);
        return new DurationValue(Number(match[1]), match[2] as "ms" | "s");
    }

    #parseCubicBezier(value: JsonValue): CubicBezierValue {
        if (!Array.isArray(value) || value.length !== 4 || !value.every((item) => typeof item === "number")) {
            throw new HrdtTokenReaderError(`Expected cubicBezier [n, n, n, n], got: ${JSON.stringify(value)}`);
        }
        return new CubicBezierValue(value[0] as number, value[1] as number, value[2] as number, value[3] as number);
    }

    #parseStrokeStyle(value: JsonValue): StrokeStyleValue {
        if (typeof value === "string") return value as StrokeStyleValue;
        if (!this.#isObject(value)) throw new HrdtTokenReaderError(`Expected strokeStyle, got: ${JSON.stringify(value)}`);
        const dashArray = (value["dashArray"] as JsonValue[]).map((dash) => this.#parseReference(dash) ?? this.#parseDimension(dash));
        return new StrokeStyleObject(dashArray, value["lineCap"] as "round" | "butt" | "square");
    }

    #parseBorder(value: JsonValue): BorderValue {
        if (!this.#isObject(value)) throw new HrdtTokenReaderError(`Expected border object, got: ${JSON.stringify(value)}`);
        return new BorderValue(
            this.#parseReference(value["color"]) ?? this.#parseColor(value["color"]),
            this.#parseReference(value["width"]) ?? this.#parseDimension(value["width"]),
            this.#parseReference(value["style"]) ?? this.#parseStrokeStyle(value["style"]),
        );
    }

    #parseTransition(value: JsonValue): TransitionValue {
        if (!this.#isObject(value)) throw new HrdtTokenReaderError(`Expected transition object, got: ${JSON.stringify(value)}`);
        return new TransitionValue(
            this.#parseReference(value["duration"]) ?? this.#parseDuration(value["duration"]),
            this.#parseReference(value["delay"]) ?? this.#parseDuration(value["delay"]),
            this.#parseReference(value["timingFunction"]) ?? this.#parseCubicBezier(value["timingFunction"]),
        );
    }

    #parseShadow(value: JsonValue): ShadowLayer | TokenReference | (ShadowLayer | TokenReference)[] {
        if (Array.isArray(value)) return value.map((item) => this.#parseReference(item) ?? this.#parseShadowLayer(item));
        return this.#parseReference(value) ?? this.#parseShadowLayer(value);
    }

    #parseShadowLayer(value: JsonValue): ShadowLayer {
        if (!this.#isObject(value)) throw new HrdtTokenReaderError(`Expected shadow layer object, got: ${JSON.stringify(value)}`);
        return new ShadowLayer(
            this.#parseReference(value["color"]) ?? this.#parseColor(value["color"]),
            this.#parseReference(value["offsetX"]) ?? this.#parseDimension(value["offsetX"]),
            this.#parseReference(value["offsetY"]) ?? this.#parseDimension(value["offsetY"]),
            this.#parseReference(value["blur"]) ?? this.#parseDimension(value["blur"]),
            this.#parseReference(value["spread"]) ?? this.#parseDimension(value["spread"]),
            value["inset"] === true,
        );
    }

    #parseGradient(value: JsonValue): (GradientStop | TokenReference)[] {
        if (!Array.isArray(value)) throw new HrdtTokenReaderError(`Expected gradient stops array, got: ${JSON.stringify(value)}`);
        return value.map((item) => {
            const reference = this.#parseReference(item);
            if (reference !== undefined) return reference;
            if (!this.#isObject(item)) throw new HrdtTokenReaderError(`Expected gradient stop object, got: ${JSON.stringify(item)}`);
            return new GradientStop(
                this.#parseReference(item["color"]) ?? this.#parseColor(item["color"]),
                this.#parseReference(item["position"]) ?? this.#parseNumber(item["position"]),
            );
        });
    }

    #parseTypography(value: JsonValue): TypographyValue {
        if (!this.#isObject(value)) throw new HrdtTokenReaderError(`Expected typography object, got: ${JSON.stringify(value)}`);
        return new TypographyValue(
            this.#parseReference(value["fontFamily"]) ?? this.#parseFontFamily(value["fontFamily"]),
            this.#parseReference(value["fontSize"]) ?? this.#parseDimension(value["fontSize"]),
            this.#parseReference(value["fontWeight"]) ?? this.#parseFontWeight(value["fontWeight"]),
            this.#parseReference(value["letterSpacing"]) ?? this.#parseDimension(value["letterSpacing"]),
            this.#parseReference(value["lineHeight"]) ?? this.#parseNumber(value["lineHeight"]),
        );
    }

    #parseReference(value: JsonValue): TokenReference | undefined {
        return typeof value === "string" && REFERENCE_RE.test(value)
            ? new TokenReference(value.slice(1, -1))
            : undefined;
    }

    #isObject(value: unknown): value is JsonObject {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    #round(value: number): number {
        return Number(value.toFixed(3));
    }
}

/** Thrown when HRDT content cannot be parsed into the token model. */
export class HrdtTokenReaderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HrdtTokenReaderError";
    }
}
