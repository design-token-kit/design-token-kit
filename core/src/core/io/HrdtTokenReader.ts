import { readFile } from "node:fs/promises";
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

const DIMENSION_RE = /^(-?\d+(?:\.\d+)?)(px|rem)$/;
const DURATION_RE = /^(-?\d+(?:\.\d+)?)(ms|s)$/;
const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const REFERENCE_RE = /^\{[^{}]+\}$/;

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
export class HrdtTokenReader {

    parseRaw(hrdtContent: string): unknown {
        return new SimpleHrdtParser(hrdtContent).parse();
    }

    parse(hrdtContent: string): Dtcg {
        const root = this.#parseRoot(new SimpleHrdtParser(hrdtContent).parse());
        return new Dtcg(root);
    }

    async parseFile(filePath: string): Promise<Dtcg> {
        return this.parse(await readFile(filePath, "utf8"));
    }

    #parseRoot(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            if (key === "$schema") continue;
            if (!this.#isObject(value)) continue;
            if (key === "primitive") {
                children.set(key, this.#parsePrimitiveRoot(value as JsonObject));
            } else {
                children.set(key, this.#parseReferenceGroup(value as JsonObject));
            }
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveRoot(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [typeName, tokens] of Object.entries(raw)) {
            if (!TOKEN_TYPES.has(typeName)) {
                throw new HrdtTokenReaderError(`Unknown primitive token type: "${typeName}"`);
            }
            const tokenType = typeName as TokenType;
            children.set(typeName, this.#parsePrimitiveTypeGroup(tokens as JsonObject, tokenType));
        }
        return new TokenGroup({ children });
    }

    #parsePrimitiveTypeGroup(raw: JsonObject, tokenType: TokenType): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, value] of Object.entries(raw)) {
            children.set(name, this.#parsePrimitiveToken(value, tokenType));
        }
        return new TokenGroup({ type: tokenType, children });
    }

    #parsePrimitiveToken(value: JsonValue, tokenType: TokenType): TokenNode<unknown> {
        if (typeof value === "string" && REFERENCE_RE.test(value)) {
            return new AliasToken(new TokenReference(value.slice(1, -1)));
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

    #parseReferenceGroup(raw: JsonObject): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [key, value] of Object.entries(raw)) {
            if (this.#isLeaf(value)) {
                children.set(key, this.#parseReferenceToken(value));
            } else {
                children.set(key, this.#parseReferenceGroup(value as JsonObject));
            }
        }
        return new TokenGroup({ children });
    }

    #isLeaf(value: JsonValue): boolean {
        return !this.#isObject(value) || Array.isArray(value);
    }

    #parseReferenceToken(value: JsonValue): TokenNode<unknown> {
        if (typeof value === "string" && REFERENCE_RE.test(value)) {
            return new AliasToken(new TokenReference(value.slice(1, -1)));
        }
        throw new HrdtTokenReaderError(`Expected a reference in non-primitive group, got: ${JSON.stringify(value)}`);
    }

    #parseColor(value: JsonValue): ColorValue {
        if (typeof value !== "string" || !HEX_RE.test(value)) {
            throw new HrdtTokenReaderError(`Expected hex color, got: ${JSON.stringify(value)}`);
        }
        const normalized = value.toLowerCase();
        const hex = normalized.slice(0, 7);
        const r = parseInt(normalized.slice(1, 3), 16);
        const g = parseInt(normalized.slice(3, 5), 16);
        const b = parseInt(normalized.slice(5, 7), 16);
        const alpha = normalized.length === 9
            ? this.#round(parseInt(normalized.slice(7, 9), 16) / 255)
            : 1;
        return new ColorValue(
            "srgb",
            [this.#round(r / 255), this.#round(g / 255), this.#round(b / 255)],
            alpha,
            hex,
        );
    }

    #parseDimension(value: JsonValue): DimensionValue {
        if (typeof value !== "string") {
            throw new HrdtTokenReaderError(`Expected dimension string, got: ${JSON.stringify(value)}`);
        }
        const match = value.match(DIMENSION_RE);
        if (!match) {
            throw new HrdtTokenReaderError(`Expected dimension with px/rem unit, got: "${value}"`);
        }
        return new DimensionValue(Number(match[1]), match[2] as "px" | "rem");
    }

    #parseFontFamily(value: JsonValue): string | string[] {
        if (typeof value === "string") return value;
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
        throw new HrdtTokenReaderError(`Expected fontFamily string or array, got: ${JSON.stringify(value)}`);
    }

    #parseFontWeight(value: JsonValue): FontWeightValue {
        if (typeof value === "string" || typeof value === "number") return value as FontWeightValue;
        throw new HrdtTokenReaderError(`Expected fontWeight string or number, got: ${JSON.stringify(value)}`);
    }

    #parseNumber(value: JsonValue): number {
        if (typeof value !== "number") {
            throw new HrdtTokenReaderError(`Expected number, got: ${JSON.stringify(value)}`);
        }
        return value;
    }

    #parseDuration(value: JsonValue): DurationValue {
        if (typeof value !== "string") {
            throw new HrdtTokenReaderError(`Expected duration string, got: ${JSON.stringify(value)}`);
        }
        const match = value.match(DURATION_RE);
        if (!match) {
            throw new HrdtTokenReaderError(`Expected duration with ms/s unit, got: "${value}"`);
        }
        return new DurationValue(Number(match[1]), match[2] as "ms" | "s");
    }

    #parseCubicBezier(value: JsonValue): CubicBezierValue {
        if (!Array.isArray(value) || value.length !== 4 || !value.every((v) => typeof v === "number")) {
            throw new HrdtTokenReaderError(`Expected cubicBezier [n, n, n, n], got: ${JSON.stringify(value)}`);
        }
        return new CubicBezierValue(value[0] as number, value[1] as number, value[2] as number, value[3] as number);
    }

    #parseStrokeStyle(value: JsonValue): StrokeStyleValue {
        if (typeof value === "string") return value as StrokeStyleValue;
        if (this.#isObject(value)) {
            const obj = value as JsonObject;
            const dashArray = (obj["dashArray"] as JsonValue[]).map((d) => this.#parseDimension(d));
            return new StrokeStyleObject(dashArray, obj["lineCap"] as "round" | "butt" | "square");
        }
        throw new HrdtTokenReaderError(`Expected strokeStyle, got: ${JSON.stringify(value)}`);
    }

    #parseBorder(value: JsonValue): BorderValue {
        if (!this.#isObject(value)) {
            throw new HrdtTokenReaderError(`Expected border object, got: ${JSON.stringify(value)}`);
        }
        const obj = value as JsonObject;
        return new BorderValue(
            this.#parseColor(obj["color"]),
            this.#parseDimension(obj["width"]),
            this.#parseStrokeStyle(obj["style"]),
        );
    }

    #parseTransition(value: JsonValue): TransitionValue {
        if (!this.#isObject(value)) {
            throw new HrdtTokenReaderError(`Expected transition object, got: ${JSON.stringify(value)}`);
        }
        const obj = value as JsonObject;
        return new TransitionValue(
            this.#parseDuration(obj["duration"]),
            this.#parseDuration(obj["delay"]),
            this.#parseCubicBezier(obj["timingFunction"]),
        );
    }

    #parseShadow(value: JsonValue): ShadowLayer | (ShadowLayer | TokenReference)[] {
        if (Array.isArray(value)) return value.map((item) => this.#parseShadowLayer(item));
        return this.#parseShadowLayer(value);
    }

    #parseShadowLayer(value: JsonValue): ShadowLayer {
        if (!this.#isObject(value)) {
            throw new HrdtTokenReaderError(`Expected shadow layer object, got: ${JSON.stringify(value)}`);
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

    #parseGradient(value: JsonValue): GradientStop[] {
        if (!Array.isArray(value)) {
            throw new HrdtTokenReaderError(`Expected gradient stops array, got: ${JSON.stringify(value)}`);
        }
        return value.map((item) => {
            if (!this.#isObject(item)) {
                throw new HrdtTokenReaderError(`Expected gradient stop object, got: ${JSON.stringify(item)}`);
            }
            const obj = item as JsonObject;
            return new GradientStop(this.#parseColor(obj["color"]), this.#parseNumber(obj["position"]));
        });
    }

    #parseTypography(value: JsonValue): TypographyValue {
        if (!this.#isObject(value)) {
            throw new HrdtTokenReaderError(`Expected typography object, got: ${JSON.stringify(value)}`);
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

    #isObject(value: JsonValue): value is JsonObject {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    #round(value: number): number {
        return Number(value.toFixed(3));
    }
}

/**
 * Thrown when the YAML content does not conform to the HRDT token format.
 */
export class HrdtTokenReaderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HrdtTokenReaderError";
    }
}

type ParsedHrdtLine = { indent: number; text: string };

class SimpleHrdtParser {
    readonly #lines: ParsedHrdtLine[];
    #index = 0;

    constructor(content: string) {
        this.#lines = content
            .replace(/^﻿/, "")
            .split(/\r?\n/g)
            .map((line) => line.replace(/\s+$/u, ""))
            .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith("#"))
            .map((line) => ({
                indent: line.length - line.trimStart().length,
                text: line.trimStart(),
            }));
    }

    parse(): JsonObject {
        const result = this.#parseBlock(0);
        if (typeof result !== "object" || result === null || Array.isArray(result)) {
            throw new HrdtTokenReaderError("YAML root must be an object.");
        }
        return result as JsonObject;
    }

    #parseBlock(indent: number): JsonValue {
        const line = this.#current();
        if (!line || line.indent < indent) return {};
        return line.text.startsWith("- ") ? this.#parseSequence(indent) : this.#parseMapping(indent);
    }

    #parseMapping(indent: number): JsonObject {
        const output: JsonObject = {};
        while (this.#index < this.#lines.length) {
            const line = this.#current()!;
            if (line.indent < indent) break;
            if (line.indent > indent) throw new HrdtTokenReaderError(`Unexpected indentation near "${line.text}".`);
            if (line.text.startsWith("- ")) break;
            const { key, value } = this.#parseKeyValue(line.text);
            this.#index += 1;
            output[key] = value === undefined
                ? this.#parseBlock(this.#nextIndent(indent))
                : this.#parseScalar(value);
        }
        return output;
    }

    #parseSequence(indent: number): JsonValue[] {
        const output: JsonValue[] = [];
        while (this.#index < this.#lines.length) {
            const line = this.#current()!;
            if (line.indent < indent) break;
            if (line.indent !== indent || !line.text.startsWith("- ")) break;
            const itemText = line.text.slice(2).trim();
            this.#index += 1;
            if (itemText.includes(":")) {
                const { key, value } = this.#parseKeyValue(itemText);
                const item: JsonObject = {};
                item[key] = value === undefined
                    ? this.#parseBlock(this.#nextIndent(indent))
                    : this.#parseScalar(value);
                if (this.#current()?.indent === indent + 2 && !this.#current()?.text.startsWith("- ")) {
                    Object.assign(item, this.#parseMapping(indent + 2));
                }
                output.push(item);
            } else {
                output.push(this.#parseScalar(itemText));
            }
        }
        return output;
    }

    #parseKeyValue(text: string): { key: string; value?: string } {
        const delimiter = text.indexOf(":");
        if (delimiter < 0) throw new HrdtTokenReaderError(`Expected key-value pair, got "${text}".`);
        const rawKey = text.slice(0, delimiter).trim();
        if (!rawKey) throw new HrdtTokenReaderError(`Expected non-empty key in "${text}".`);
        const value = text.slice(delimiter + 1).trim();
        const key = (rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))
            ? this.#unquote(rawKey)
            : rawKey;
        return value.length === 0 ? { key } : { key, value };
    }

    #parseScalar(value: string): JsonValue {
        if (value.startsWith("[") && value.endsWith("]")) return this.#parseInlineArray(value);
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return this.#unquote(value);
        if (value === "true") return true;
        if (value === "false") return false;
        if (value === "null") return null;
        if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
        return value;
    }

    #parseInlineArray(value: string): JsonValue[] {
        const inner = value.slice(1, -1).trim();
        if (!inner) return [];
        return this.#splitInlineArray(inner).map((item) => this.#parseScalar(item.trim()));
    }

    #splitInlineArray(value: string): string[] {
        const items: string[] = [];
        let current = "";
        let quote: '"' | "'" | undefined;
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            if (quote) {
                current += char;
                if (char === quote && value[i - 1] !== "\\") quote = undefined;
                continue;
            }
            if (char === '"' || char === "'") { quote = char; current += char; continue; }
            if (char === ",") { items.push(current); current = ""; continue; }
            current += char;
        }
        items.push(current);
        return items;
    }

    #unquote(value: string): string {
        if (value.startsWith('"')) return JSON.parse(value) as string;
        return value.slice(1, -1).replace(/''/g, "'");
    }

    #current(): ParsedHrdtLine | undefined {
        return this.#lines[this.#index];
    }

    #nextIndent(currentIndent: number): number {
        const nextLine = this.#current();
        if (!nextLine || nextLine.indent <= currentIndent) return currentIndent + 2;
        return nextLine.indent;
    }
}
