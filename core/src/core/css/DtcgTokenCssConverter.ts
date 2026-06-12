import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { BorderValue } from "#/core/model/values/BorderValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import type { TokenCssConverter } from "#/core/css/TokenCssConverter";

/**
 * Converts token documents in any supported format to CSS custom properties.
 *
 * The first document is treated as the base token set, all subsequent
 * documents as theme overrides.
 * Base tokens are emitted under {@code :root}.
 * Theme tokens are emitted under {@code :root[data-theme="name"]}.
 */
export class DtcgTokenCssConverter implements TokenCssConverter {

    readonly #loader = new DtcgListLoader();

    async convert(sources: string[]): Promise<string> {
        const list = await this.#loader.load(sources);
        return this.convertList(list);
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        const blocks: string[] = [];

        const baseBlock = renderBlock(":root", collectFromDoc(list.base));
        if (baseBlock) blocks.push(baseBlock);

        for (const [themeName, theme] of list.themes) {
            const block = renderBlock(`:root[data-theme="${themeName}"]`, collectFromDoc(theme));
            if (block) blocks.push(block);
        }

        return blocks.join("\n\n");
    }
}

function tokenPathToCssVar(path: string): string {
    return `--${path.replace(/\./g, "-")}`;
}

function refToCssVar(ref: TokenReference): string {
    return `var(${tokenPathToCssVar(ref.value)})`;
}

function colorToCss(color: ColorValue): string {
    if (color.hex && color.alpha === 1) return color.hex;
    const components = color.components.map((c) => (c === "none" ? "none" : String(c))).join(" ");
    const alpha = color.alpha !== 1 ? ` / ${color.alpha}` : "";
    return `color(${color.colorSpace} ${components}${alpha})`;
}

function dimensionOrRefToCss(value: DimensionValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `${value.value}${value.unit}`;
}

function durationOrRefToCss(value: DurationValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `${value.value}${value.unit}`;
}

function timingOrRefToCss(value: CubicBezierValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
}

function shadowLayerToCss(layer: ShadowLayer): string {
    const inset = layer.inset ? "inset " : "";
    return `${inset}${dimensionOrRefToCss(layer.offsetX)} ${dimensionOrRefToCss(layer.offsetY)} ${dimensionOrRefToCss(layer.blur)} ${dimensionOrRefToCss(layer.spread)} ${layer.color instanceof TokenReference ? refToCssVar(layer.color) : colorToCss(layer.color)}`;
}

function tokenValueToCss(value: unknown): string | undefined {
    if (value instanceof TokenReference) return refToCssVar(value);
    if (value instanceof ColorValue) return colorToCss(value);
    if (value instanceof DimensionValue) return `${value.value}${value.unit}`;
    if (value instanceof DurationValue) return `${value.value}${value.unit}`;
    if (value instanceof CubicBezierValue) return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;

    if (value instanceof ShadowLayer) return shadowLayerToCss(value);

    if (value instanceof BorderValue) {
        const width = dimensionOrRefToCss(value.width);
        const style = value.style instanceof TokenReference
            ? refToCssVar(value.style)
            : value.style instanceof StrokeStyleObject ? "dashed" : value.style;
        const color = value.color instanceof TokenReference ? refToCssVar(value.color) : colorToCss(value.color);
        return `${width} ${style} ${color}`;
    }

    if (value instanceof TransitionValue) {
        return `${durationOrRefToCss(value.duration)} ${timingOrRefToCss(value.timingFunction)} ${durationOrRefToCss(value.delay)}`;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return undefined;
        if (value[0] instanceof GradientStop || (value[0] instanceof TokenReference && !(value[0] instanceof ShadowLayer))) {
            if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
                const isGradient = value.some((item) => item instanceof GradientStop);
                if (isGradient) return undefined;
            }
        }
        if (value[0] instanceof ShadowLayer || value[0] instanceof TokenReference) {
            const parts = value.map((item) =>
                item instanceof ShadowLayer ? shadowLayerToCss(item) : refToCssVar(item as TokenReference),
            );
            return parts.join(", ");
        }
        return value.map((f) =>
            f instanceof TokenReference ? refToCssVar(f) : `"${f}"`,
        ).join(", ");
    }

    if (value instanceof TypographyValue) return undefined;

    return undefined;
}

function collectDeclarations(group: TokenGroup, path: string[]): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of group.entries()) {
        const childPath = [...path, key];
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, childPath));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value);
            if (css !== undefined) {
                result.push([tokenPathToCssVar(childPath.join(".")), css]);
            }
        }
    }
    return result;
}

function collectFromDoc(doc: Dtcg): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of doc.entries()) {
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, [key]));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value);
            if (css !== undefined) result.push([tokenPathToCssVar(key), css]);
        }
    }
    return result;
}

function renderBlock(selector: string, declarations: Array<[string, string]>): string {
    if (declarations.length === 0) return "";
    const lines = declarations.map(([prop, val]) => `  ${prop}: ${val};`).join("\n");
    return `${selector} {\n${lines}\n}`;
}
