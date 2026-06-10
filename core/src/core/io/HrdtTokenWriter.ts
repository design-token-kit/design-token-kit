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

/**
 * Serializes a {@link Dtcg} document to the HRDT token format.
 *
 * The HRDT format uses YAML syntax and mirrors what {@link HrdtTokenReader} accepts:
 * primitive tokens are grouped by type under `primitive.<type>`,
 * all other groups contain only alias references.
 */
export class HrdtTokenWriter {

    write(doc: Dtcg): string {
        const lines: string[] = [];
        for (const [key, child] of doc.entries()) {
            if (child instanceof TokenGroup) {
                lines.push(`${key}:`);
                if (key === "primitive") {
                    this.#writePrimitiveRoot(child, lines, 1);
                } else {
                    this.#writeReferenceGroup(child, lines, 1);
                }
                lines.push("");
            }
        }
        return lines.join("\n").trimEnd() + "\n";
    }

    #writePrimitiveRoot(group: TokenGroup, lines: string[], depth: number): void {
        for (const [typeName, child] of group.entries()) {
            if (!(child instanceof TokenGroup)) continue;
            lines.push(`${this.#indent(depth)}${typeName}:`);
            for (const [name, token] of child.entries()) {
                if (token instanceof TokenGroup) continue;
                const serialized = this.#serializePrimitiveToken(token as TokenNode<unknown>);
                if (typeof serialized === "string" && !serialized.includes("\n")) {
                    lines.push(`${this.#indent(depth + 1)}${name}: ${serialized}`);
                } else if (typeof serialized === "string") {
                    lines.push(`${this.#indent(depth + 1)}${name}:`);
                    for (const subLine of serialized.split("\n")) {
                        lines.push(`${this.#indent(depth + 2)}${subLine}`);
                    }
                } else {
                    lines.push(`${this.#indent(depth + 1)}${name}:`);
                    for (const subLine of serialized) {
                        lines.push(`${this.#indent(depth + 2)}${subLine}`);
                    }
                }
            }
        }
    }

    #writeReferenceGroup(group: TokenGroup, lines: string[], depth: number): void {
        for (const [key, child] of group.entries()) {
            if (child instanceof TokenGroup) {
                lines.push(`${this.#indent(depth)}${key}:`);
                this.#writeReferenceGroup(child, lines, depth + 1);
            } else {
                const value = (child as TokenNode<unknown>).value;
                const ref = value instanceof TokenReference ? value.toString() : String(value);
                lines.push(`${this.#indent(depth)}${key}: "${ref}"`);
            }
        }
    }

    #serializePrimitiveToken(token: TokenNode<unknown>): string | string[] {
        const value = token.value;
        if (value instanceof TokenReference) return `"${value}"`;

        if (token instanceof ColorToken) return this.#serializeColor(value as ColorValue);
        if (token instanceof DimensionToken) return this.#serializeDimension(value as DimensionValue);
        if (token instanceof DurationToken) return this.#serializeDuration(value as DurationValue);
        if (token instanceof FontFamilyToken) return this.#serializeFontFamily(value as string | string[]);
        if (token instanceof FontWeightToken) return String(value);
        if (token instanceof NumberToken) return String(value);
        if (token instanceof CubicBezierToken) return this.#serializeCubicBezier(value as CubicBezierValue);
        if (token instanceof StrokeStyleToken) return this.#serializeStrokeStyle(value);
        if (token instanceof BorderToken) return this.#serializeBorder(value as BorderValue);
        if (token instanceof TransitionToken) return this.#serializeTransition(value as TransitionValue);
        if (token instanceof ShadowToken) return this.#serializeShadow(value);
        if (token instanceof GradientToken) return this.#serializeGradient(value as (GradientStop | TokenReference)[]);
        if (token instanceof TypographyToken) return this.#serializeTypography(value as TypographyValue);
        if (token instanceof AliasToken) return `"${value}"`;
        return String(value);
    }

    #serializeColor(color: ColorValue): string {
        if (color.hex) {
            if (color.alpha === 1) return color.hex;
            const alphaHex = Math.round(color.alpha * 255).toString(16).padStart(2, "0");
            return `${color.hex}${alphaHex}`;
        }
        const [r, g, b] = color.components;
        const toHex = (v: number | "none") => typeof v === "number" ? Math.round(v * 255).toString(16).padStart(2, "0") : "00";
        const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        if (color.alpha === 1) return base;
        const alphaHex = Math.round(color.alpha * 255).toString(16).padStart(2, "0");
        return `${base}${alphaHex}`;
    }

    #serializeDimension(dim: DimensionValue): string {
        return `${dim.value}${dim.unit}`;
    }

    #serializeDuration(dur: DurationValue): string {
        return `${dur.value}${dur.unit}`;
    }

    #serializeFontFamily(value: string | string[]): string {
        if (Array.isArray(value)) {
            const items = value.map((v) => v.includes(" ") ? `"${v}"` : v).join(", ");
            return `[${items}]`;
        }
        return value;
    }

    #serializeCubicBezier(cb: CubicBezierValue): string {
        return `[${cb.p1x}, ${cb.p1y}, ${cb.p2x}, ${cb.p2y}]`;
    }

    #serializeStrokeStyle(value: unknown): string | string[] {
        if (typeof value === "string") return value;
        if (value instanceof StrokeStyleObject) {
            const dashArray = value.dashArray
                .map((d) => d instanceof TokenReference ? `"${d}"` : this.#serializeDimension(d as DimensionValue))
                .join(", ");
            return [`dashArray: [${dashArray}]`, `lineCap: ${value.lineCap}`];
        }
        return String(value);
    }

    #serializeBorder(border: BorderValue): string[] {
        return [
            `color: "${this.#serializeColorOrRef(border.color)}"`,
            `width: ${this.#serializeDimensionOrRef(border.width)}`,
            `style: ${this.#serializeStrokeStyleInline(border.style)}`,
        ];
    }

    #serializeTransition(t: TransitionValue): string[] {
        return [
            `duration: ${this.#serializeDurationOrRef(t.duration)}`,
            `delay: ${this.#serializeDurationOrRef(t.delay)}`,
            `timingFunction: ${this.#serializeTimingFunctionOrRef(t.timingFunction)}`,
        ];
    }

    #serializeShadow(value: unknown): string[] {
        const layers = Array.isArray(value) ? value : [value];
        if (layers.length === 1) {
            return this.#serializeShadowLayerLines(layers[0] as ShadowLayer);
        }
        const result: string[] = [];
        for (const layer of layers) {
            if (layer instanceof TokenReference) {
                result.push(`- "${layer}"`);
            } else {
                const [first, ...rest] = this.#serializeShadowLayerLines(layer as ShadowLayer);
                result.push(`- ${first}`);
                result.push(...rest.map((l) => `  ${l}`));
            }
        }
        return result;
    }

    #serializeShadowLayerLines(layer: ShadowLayer): string[] {
        const lines = [
            `color: "${this.#serializeColorOrRef(layer.color)}"`,
            `offsetX: ${this.#serializeDimensionOrRef(layer.offsetX)}`,
            `offsetY: ${this.#serializeDimensionOrRef(layer.offsetY)}`,
            `blur: ${this.#serializeDimensionOrRef(layer.blur)}`,
            `spread: ${this.#serializeDimensionOrRef(layer.spread)}`,
        ];
        if (layer.inset) lines.push("inset: true");
        return lines;
    }

    #serializeGradient(stops: (GradientStop | TokenReference)[]): string[] {
        const result: string[] = [];
        for (const stop of stops) {
            if (stop instanceof TokenReference) {
                result.push(`- "${stop}"`);
            } else {
                result.push(`- color: "${this.#serializeColorOrRef(stop.color)}"`);
                result.push(`  position: ${stop.position instanceof TokenReference ? `"${stop.position}"` : stop.position}`);
            }
        }
        return result;
    }

    #serializeTypography(typo: TypographyValue): string[] {
        const lines: string[] = [];
        if (typo.fontFamily !== undefined) {
            const ff = typo.fontFamily instanceof TokenReference
                ? `"${typo.fontFamily}"`
                : this.#serializeFontFamily(typo.fontFamily as string | string[]);
            lines.push(`fontFamily: ${ff}`);
        }
        if (typo.fontSize !== undefined) lines.push(`fontSize: ${this.#serializeDimensionOrRef(typo.fontSize)}`);
        if (typo.fontWeight !== undefined) lines.push(`fontWeight: ${typo.fontWeight instanceof TokenReference ? `"${typo.fontWeight}"` : typo.fontWeight}`);
        if (typo.letterSpacing !== undefined) lines.push(`letterSpacing: ${this.#serializeDimensionOrRef(typo.letterSpacing)}`);
        if (typo.lineHeight !== undefined) lines.push(`lineHeight: ${typo.lineHeight instanceof TokenReference ? `"${typo.lineHeight}"` : typo.lineHeight}`);
        return lines;
    }

    #serializeColorOrRef(value: ColorValue | TokenReference): string {
        return value instanceof TokenReference ? value.toString() : this.#serializeColor(value);
    }

    #serializeDimensionOrRef(value: DimensionValue | TokenReference): string {
        return value instanceof TokenReference ? `"${value}"` : this.#serializeDimension(value);
    }

    #serializeDurationOrRef(value: DurationValue | TokenReference): string {
        return value instanceof TokenReference ? `"${value}"` : this.#serializeDuration(value);
    }

    #serializeTimingFunctionOrRef(value: CubicBezierValue | TokenReference): string {
        return value instanceof TokenReference ? `"${value}"` : this.#serializeCubicBezier(value);
    }

    #serializeStrokeStyleInline(value: unknown): string {
        if (typeof value === "string") return value;
        if (value instanceof TokenReference) return `"${value}"`;
        if (value instanceof StrokeStyleObject) {
            const dashArray = value.dashArray
                .map((d) => d instanceof TokenReference ? `"${d}"` : this.#serializeDimension(d as DimensionValue))
                .join(", ");
            return `{dashArray: [${dashArray}], lineCap: ${value.lineCap}}`;
        }
        return String(value);
    }

    #indent(depth: number): string {
        return "  ".repeat(depth);
    }
}
