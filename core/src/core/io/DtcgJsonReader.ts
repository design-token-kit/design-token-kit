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
 * Parses a DTCG 2025.10 JSON document into a {@link Dtcg}.
 *
 * A child object is treated as a token when it contains `$value` or `$ref`,
 * and as a group otherwise.
 *
 * @see https://tr.designtokens.org/format/
 */
export class DtcgJsonReader {

    parse(content: string, source?: string): Dtcg {
        const raw = JSON.parse(content) as JsonObject;
        const root = this.#parseGroup(raw, undefined);
        return new Dtcg(root, source);
    }

    #parseGroup(raw: JsonObject, inheritedType: TokenType | undefined): TokenGroup {
        const type = this.#resolveType(raw["$type"], inheritedType);
        const description = typeof raw["$description"] === "string" ? raw["$description"] : undefined;
        const deprecated = this.#parseDeprecated(raw["$deprecated"]);
        const extensions = this.#parseExtensions(raw["$extensions"]);
        const extendsRef = this.#parseExtendsRef(raw["$extends"]);
        const root = raw["$root"] != null ? this.#parseToken(raw["$root"] as JsonObject, type) : undefined;

        const children = new Map<string, TokenGroup | TokenNode<unknown>>();

        for (const [key, value] of Object.entries(raw)) {
            if (GROUP_KEYS.has(key)) continue;
            if (typeof value !== "object" || value === null || Array.isArray(value)) continue;

            const child = value as JsonObject;
            if (this.#isToken(child)) {
                children.set(key, this.#parseToken(child, type));
            } else {
                children.set(key, this.#parseGroup(child, type));
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
            if (typeof ref !== "string") throw new DtcgJsonReaderError("$ref must be a string");
            return this.#makeToken(type, new TokenReference(ref), description, deprecated, extensions);
        }

        const rawValue = raw["$value"];

        if (typeof rawValue === "string" && /^\{[^{}]+\}$/.test(rawValue)) {
            const ref = new TokenReference(rawValue.slice(1, -1));
            return this.#makeToken(type, ref, description, deprecated, extensions);
        }

        if (type == null) {
            throw new DtcgJsonReaderError(`Token has no $type and no inherited type: ${JSON.stringify(raw)}`);
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
            default: throw new DtcgJsonReaderError(`Unknown token type: ${String(type)}`);
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
            throw new DtcgJsonReaderError(`Invalid color value: ${JSON.stringify(raw)}`);
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
            throw new DtcgJsonReaderError(`Invalid dimension value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new DimensionValue(obj["value"] as number, obj["unit"] as DimensionUnit);
    }

    #parseFontFamily(raw: unknown): FontFamilyValue {
        if (typeof raw === "string") return raw;
        if (Array.isArray(raw)) return raw as string[];
        throw new DtcgJsonReaderError(`Invalid fontFamily value: ${JSON.stringify(raw)}`);
    }

    #parseFontWeight(raw: unknown): FontWeightValue {
        if (typeof raw === "number" || typeof raw === "string") return raw as FontWeightValue;
        throw new DtcgJsonReaderError(`Invalid fontWeight value: ${JSON.stringify(raw)}`);
    }

    #parseNumber(raw: unknown): number {
        if (typeof raw !== "number") throw new DtcgJsonReaderError(`Invalid number value: ${JSON.stringify(raw)}`);
        return raw;
    }

    #parseDuration(raw: unknown): DurationValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgJsonReaderError(`Invalid duration value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new DurationValue(obj["value"] as number, obj["unit"] as DurationUnit);
    }

    #parseCubicBezier(raw: unknown): CubicBezierValue {
        if (!Array.isArray(raw) || raw.length !== 4) {
            throw new DtcgJsonReaderError(`Invalid cubicBezier value: ${JSON.stringify(raw)}`);
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
        throw new DtcgJsonReaderError(`Invalid strokeStyle value: ${JSON.stringify(raw)}`);
    }

    #parseBorder(raw: unknown): BorderValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgJsonReaderError(`Invalid border value: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        const color = this.#parseColorOrRef(obj["color"]);
        const width = this.#parseDimensionOrRef(obj["width"]);
        const style = this.#parseStrokeStyleOrRef(obj["style"]);
        return new BorderValue(color, width, style);
    }

    #parseTransition(raw: unknown): TransitionValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgJsonReaderError(`Invalid transition value: ${JSON.stringify(raw)}`);
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
            throw new DtcgJsonReaderError(`Invalid shadow layer: ${JSON.stringify(raw)}`);
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
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) {
            return new TokenReference(raw.slice(1, -1));
        }
        return this.#parseShadowLayer(raw);
    }

    #parseGradient(raw: unknown): (GradientStop | TokenReference)[] {
        if (!Array.isArray(raw)) throw new DtcgJsonReaderError(`Invalid gradient value: ${JSON.stringify(raw)}`);
        return raw.map(item => this.#parseGradientStopOrRef(item));
    }

    #parseGradientStopOrRef(raw: unknown): GradientStop | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) {
            return new TokenReference(raw.slice(1, -1));
        }
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgJsonReaderError(`Invalid gradient stop: ${JSON.stringify(raw)}`);
        }
        const obj = raw as JsonObject;
        return new GradientStop(
            this.#parseColorOrRef(obj["color"]),
            this.#parseNumberOrRef(obj["position"]),
        );
    }

    #parseTypography(raw: unknown): TypographyValue {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new DtcgJsonReaderError(`Invalid typography value: ${JSON.stringify(raw)}`);
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
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseColor(raw);
    }

    #parseDimensionOrRef(raw: unknown): DimensionValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseDimension(raw);
    }

    #parseDurationOrRef(raw: unknown): DurationValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseDuration(raw);
    }

    #parseCubicBezierOrRef(raw: unknown): CubicBezierValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseCubicBezier(raw);
    }

    #parseStrokeStyleOrRef(raw: unknown): StrokeStyleValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseStrokeStyle(raw);
    }

    #parseFontFamilyOrRef(raw: unknown): FontFamilyValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseFontFamily(raw);
    }

    #parseFontWeightOrRef(raw: unknown): FontWeightValue | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseFontWeight(raw);
    }

    #parseNumberOrRef(raw: unknown): number | TokenReference {
        if (typeof raw === "string" && /^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return this.#parseNumber(raw);
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
        if (/^\{[^{}]+\}$/.test(raw)) return new TokenReference(raw.slice(1, -1));
        return raw;
    }
}

/**
 * Thrown when the input JSON does not conform to the expected DTCG structure.
 */
export class DtcgJsonReaderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DtcgJsonReaderError";
    }
}
