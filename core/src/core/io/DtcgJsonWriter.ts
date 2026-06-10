import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
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
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

type JsonObject = Record<string, unknown>;

const DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";

/**
 * Serializes a {@link Dtcg} document to a DTCG JSON string.
 *
 * @see https://tr.designtokens.org/format/
 */
export class DtcgJsonWriter {

    write(doc: Dtcg): string {
        return JSON.stringify(this.#toObject(doc), null, 2) + "\n";
    }

    #toObject(doc: Dtcg): JsonObject {
        const result: JsonObject = { "$schema": DTCG_SCHEMA };
        for (const [key, child] of doc.entries()) {
            result[key] = child instanceof TokenGroup
                ? this.#writeGroup(child)
                : this.#writeToken(child);
        }
        return result;
    }

    #writeGroup(group: TokenGroup): JsonObject {
        const obj: JsonObject = {};
        if (group.type !== undefined) obj["$type"] = group.type;
        if (group.description !== undefined) obj["$description"] = group.description;
        if (group.deprecated !== undefined) obj["$deprecated"] = group.deprecated;
        if (group.extensions !== undefined) obj["$extensions"] = group.extensions;
        if (group.extends !== undefined) {
            obj["$extends"] = group.extends instanceof TokenReference
                ? group.extends.toString()
                : group.extends;
        }
        if (group.root !== undefined) obj["$root"] = this.#writeToken(group.root);
        for (const [key, child] of group.entries()) {
            obj[key] = child instanceof TokenGroup
                ? this.#writeGroup(child)
                : this.#writeToken(child);
        }
        return obj;
    }

    #writeToken(token: TokenNode<unknown>): JsonObject {
        const obj: JsonObject = {};
        if (token.type !== undefined) obj["$type"] = token.type;
        if (token.description !== undefined) obj["$description"] = token.description;
        if (token.deprecated !== undefined) obj["$deprecated"] = token.deprecated;
        if (token.extensions !== undefined) obj["$extensions"] = token.extensions;

        obj["$value"] = this.#writeValue(token);
        return obj;
    }

    #writeValue(token: TokenNode<unknown>): unknown {
        const value = token.value;
        if (value instanceof TokenReference) return value.toString();

        if (token instanceof ColorToken) return this.#writeColor(value as ColorValue);
        if (token instanceof DimensionToken) return this.#writeDimension(value as DimensionValue);
        if (token instanceof FontFamilyToken) return value;
        if (token instanceof FontWeightToken) return value;
        if (token instanceof NumberToken) return value;
        if (token instanceof DurationToken) return this.#writeDuration(value as DurationValue);
        if (token instanceof CubicBezierToken) return this.#writeCubicBezier(value as CubicBezierValue);
        if (token instanceof StrokeStyleToken) return this.#writeStrokeStyle(value);
        if (token instanceof BorderToken) return this.#writeBorder(value as BorderValue);
        if (token instanceof TransitionToken) return this.#writeTransition(value as TransitionValue);
        if (token instanceof ShadowToken) return this.#writeShadow(value);
        if (token instanceof GradientToken) return this.#writeGradient(value as (GradientStop | TokenReference)[]);
        if (token instanceof TypographyToken) return this.#writeTypography(value as TypographyValue);
        if (token instanceof AliasToken) return (value as TokenReference).toString();
        return value;
    }

    #writeColor(color: ColorValue): JsonObject {
        const obj: JsonObject = {
            colorSpace: color.colorSpace,
            components: color.components,
        };
        if (color.alpha !== 1) obj["alpha"] = color.alpha;
        if (color.hex !== undefined) obj["hex"] = color.hex;
        return obj;
    }

    #writeDimension(dim: DimensionValue): JsonObject {
        return { value: dim.value, unit: dim.unit };
    }

    #writeDuration(dur: DurationValue): JsonObject {
        return { value: dur.value, unit: dur.unit };
    }

    #writeCubicBezier(cb: CubicBezierValue): number[] {
        return [cb.p1x, cb.p1y, cb.p2x, cb.p2y];
    }

    #writeStrokeStyle(value: unknown): unknown {
        if (value instanceof StrokeStyleObject) {
            return {
                dashArray: value.dashArray.map(d =>
                    d instanceof TokenReference ? d.toString() : this.#writeDimension(d as DimensionValue)
                ),
                lineCap: value.lineCap,
            };
        }
        return value;
    }

    #writeBorder(border: BorderValue): JsonObject {
        return {
            color: this.#writeColorOrRef(border.color),
            width: this.#writeDimensionOrRef(border.width),
            style: this.#writeStrokeStyleOrRef(border.style),
        };
    }

    #writeTransition(transition: TransitionValue): JsonObject {
        return {
            duration: this.#writeDurationOrRef(transition.duration),
            delay: this.#writeDurationOrRef(transition.delay),
            timingFunction: this.#writeCubicBezierOrRef(transition.timingFunction),
        };
    }

    #writeShadow(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map(item =>
                item instanceof TokenReference ? item.toString() : this.#writeShadowLayer(item as ShadowLayer)
            );
        }
        return this.#writeShadowLayer(value as ShadowLayer);
    }

    #writeShadowLayer(layer: ShadowLayer): JsonObject {
        const obj: JsonObject = {
            color: this.#writeColorOrRef(layer.color),
            offsetX: this.#writeDimensionOrRef(layer.offsetX),
            offsetY: this.#writeDimensionOrRef(layer.offsetY),
            blur: this.#writeDimensionOrRef(layer.blur),
            spread: this.#writeDimensionOrRef(layer.spread),
        };
        if (layer.inset) obj["inset"] = layer.inset;
        return obj;
    }

    #writeGradient(stops: (GradientStop | TokenReference)[]): unknown[] {
        return stops.map(stop =>
            stop instanceof TokenReference ? stop.toString() : this.#writeGradientStop(stop)
        );
    }

    #writeGradientStop(stop: GradientStop): JsonObject {
        return {
            color: this.#writeColorOrRef(stop.color),
            position: this.#writeNumberOrRef(stop.position),
        };
    }

    #writeTypography(typo: TypographyValue): JsonObject {
        const obj: JsonObject = {};
        if (typo.fontFamily !== undefined) obj["fontFamily"] = this.#writeFontFamilyOrRef(typo.fontFamily);
        if (typo.fontSize !== undefined) obj["fontSize"] = this.#writeDimensionOrRef(typo.fontSize);
        if (typo.fontWeight !== undefined) obj["fontWeight"] = this.#writeFontWeightOrRef(typo.fontWeight);
        if (typo.letterSpacing !== undefined) obj["letterSpacing"] = this.#writeDimensionOrRef(typo.letterSpacing);
        if (typo.lineHeight !== undefined) obj["lineHeight"] = this.#writeNumberOrRef(typo.lineHeight);
        return obj;
    }

    #writeColorOrRef(value: ColorValue | TokenReference): unknown {
        return value instanceof TokenReference ? value.toString() : this.#writeColor(value);
    }

    #writeDimensionOrRef(value: DimensionValue | TokenReference): unknown {
        return value instanceof TokenReference ? value.toString() : this.#writeDimension(value);
    }

    #writeDurationOrRef(value: DurationValue | TokenReference): unknown {
        return value instanceof TokenReference ? value.toString() : this.#writeDuration(value);
    }

    #writeCubicBezierOrRef(value: CubicBezierValue | TokenReference): unknown {
        return value instanceof TokenReference ? value.toString() : this.#writeCubicBezier(value);
    }

    #writeStrokeStyleOrRef(value: unknown): unknown {
        if (value instanceof TokenReference) return value.toString();
        return this.#writeStrokeStyle(value);
    }

    #writeFontFamilyOrRef(value: unknown): unknown {
        return value instanceof TokenReference ? value.toString() : value;
    }

    #writeFontWeightOrRef(value: unknown): unknown {
        return value instanceof TokenReference ? value.toString() : value;
    }

    #writeNumberOrRef(value: number | TokenReference): unknown {
        return value instanceof TokenReference ? value.toString() : value;
    }
}
