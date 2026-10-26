import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import { materializePropertyReferences } from "#/core/model/PropertyReferenceMaterializer";
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
import { CssColorValueConverter } from "#/core/platforms/css/CssColorValueConverter";
import { CssTokenMap, type CssTokenMapEntry } from "#/core/platforms/css/CssTokenMap";
import type { TokenConverter } from "#/core/platforms/TokenConverter";

/**
 * Converts token documents in any supported format to CSS custom properties.
 *
 * The first document is treated as the base token set, all subsequent
 * documents as theme overrides.
 * Base tokens are emitted under {@code :root}.
 * Theme tokens are emitted under {@code :root[data-theme="name"]}.
 */
export class CssTokenConverter implements TokenConverter {

    readonly #loader = new DtcgListLoader();

    async convert(sources: string[]): Promise<string> {
        const list = await this.#loader.load(sources);
        return this.convertList(list);
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        return this.convertListWithMap(list).css;
    }

    /**
     * Converts the list to CSS and maps every emitted custom property to its
     * token in the same pass.
     *
     * A theme token that overrides a base token shares the base entry, so
     * each custom property has exactly one entry.
     * A token absent from the base but present in several themes takes the
     * source of the first theme.
     * When several tokens of one block produce the same custom property, the
     * last one wins, as it does in the cascade.
     */
    convertListWithMap(list: DtcgList): CssConversion {
        const blocks: DeclarationBlock[] = collectBlocks(materializePropertyReferences(list));
        return {
            css: renderStylesheet(blocks),
            map: new CssTokenMap(toMapEntries(blocks)),
        };
    }
}

/**
 * CSS produced by conversion and the map of its custom properties.
 */
export interface CssConversion {
    /** Stylesheet with the custom properties. */
    readonly css: string;

    /** Map of every custom property in the stylesheet. */
    readonly map: CssTokenMap;
}

/** A custom property emitted for one token. */
interface TokenDeclaration {
    readonly customProperty: string;
    readonly value: string;
    readonly path: TokenPath;
    readonly token: TokenNode<unknown>;
}

/** Declarations emitted under one selector, with the document they came from. */
interface DeclarationBlock {
    readonly selector: string;
    readonly source: string | undefined;
    readonly declarations: readonly TokenDeclaration[];
}

function collectBlocks(list: DtcgList): DeclarationBlock[] {
    const blocks: DeclarationBlock[] = [
        { selector: ":root", source: list.base.source, declarations: collectFromDoc(list.base) },
    ];
    for (const [themeName, theme] of list.themes) {
        blocks.push({
            selector: `:root[data-theme="${themeName}"]`,
            source: theme.source,
            declarations: collectFromDoc(theme, list.base),
        });
    }
    return blocks;
}

function renderStylesheet(blocks: readonly DeclarationBlock[]): string {
    const rendered: string[] = blocks
        .map((block) => renderBlock(block.selector, block.declarations.map(toCssPair)))
        .filter((css) => css !== "");
    return rendered.join("\n\n") + (rendered.length > 0 ? "\n" : "");
}

function toCssPair(declaration: TokenDeclaration): [string, string] {
    return [declaration.customProperty, declaration.value];
}

function toMapEntries(blocks: readonly DeclarationBlock[]): CssTokenMapEntry[] {
    const entries: Map<string, CssTokenMapEntry> = new Map();
    for (const block of blocks) {
        const blockEntries: Map<string, CssTokenMapEntry> = new Map();
        for (const declaration of block.declarations) {
            blockEntries.set(declaration.customProperty, toMapEntry(declaration, block.source));
        }
        for (const [customProperty, entry] of blockEntries) {
            if (!entries.has(customProperty)) entries.set(customProperty, entry);
        }
    }
    return [...entries.values()];
}

function toMapEntry(declaration: TokenDeclaration, source: string | undefined): CssTokenMapEntry {
    return {
        customProperty: declaration.customProperty,
        path: declaration.path,
        type: declaration.token.type,
        description: declaration.token.description,
        source,
    };
}

function declare(path: TokenPath, token: TokenNode<unknown>, value: string): TokenDeclaration {
    return { customProperty: tokenPathToCssVar(path.toString()), value, path, token };
}

function tokenPathToCssVar(path: string): string {
    return `--${path.replace(/\./g, "-")}`;
}

function refToCssVar(ref: TokenReference): string {
    return `var(${tokenPathToCssVar(ref.value)})`;
}

const cssColorValueConverter = new CssColorValueConverter();

function colorToCss(color: ColorValue, doc: Dtcg, base?: Dtcg): string {
    return cssColorValueConverter.convert(materializeColor(color, doc, base));
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

function shadowLayerToCss(layer: ShadowLayer, doc: Dtcg, base?: Dtcg): string {
    const inset = layer.inset ? "inset " : "";
    const color = layer.color instanceof TokenReference ? refToCssVar(layer.color) : colorToCss(layer.color, doc, base);
    return `${inset}${dimensionOrRefToCss(layer.offsetX)} ${dimensionOrRefToCss(layer.offsetY)} ${dimensionOrRefToCss(layer.blur)} ${dimensionOrRefToCss(layer.spread)} ${color}`;
}

function typographyToCss(value: TypographyValue): string {
    const fontFamily = value.fontFamily instanceof TokenReference
        ? refToCssVar(value.fontFamily)
        : Array.isArray(value.fontFamily)
            ? value.fontFamily
                .map((item) => item instanceof TokenReference ? refToCssVar(item) : `"${item}"`)
                .join(", ")
            : `"${value.fontFamily}"`;
    const fontWeight = value.fontWeight instanceof TokenReference
        ? refToCssVar(value.fontWeight)
        : String(value.fontWeight);
    const lineHeight = value.lineHeight instanceof TokenReference
        ? refToCssVar(value.lineHeight)
        : String(value.lineHeight);

    return `${fontWeight} ${dimensionOrRefToCss(value.fontSize)}/${lineHeight} ${fontFamily}`;
}

function gradientToCss(value: Array<GradientStop | TokenReference>, doc: Dtcg, base?: Dtcg): string {
    const stops = value.map((stop) => {
        if (stop instanceof TokenReference) return refToCssVar(stop);

        const color = stop.color instanceof TokenReference ? refToCssVar(stop.color) : colorToCss(stop.color, doc, base);
        const position = stop.position instanceof TokenReference
            ? `calc(${refToCssVar(stop.position)} * 100%)`
            : `${stop.position * 100}%`;

        return `${color} ${position}`;
    });

    return `linear-gradient(180deg, ${stops.join(", ")})`;
}

function tokenValueToCss(value: unknown, doc: Dtcg, base?: Dtcg): string | undefined {
    if (value instanceof TokenReference) return refToCssVar(value);
    if (value instanceof ColorValue) return colorToCss(value, doc, base);
    if (value instanceof DimensionValue) return `${value.value}${value.unit}`;
    if (value instanceof DurationValue) return `${value.value}${value.unit}`;
    if (value instanceof CubicBezierValue) return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;

    if (value instanceof ShadowLayer) return shadowLayerToCss(value, doc, base);

    if (value instanceof BorderValue) {
        const width = dimensionOrRefToCss(value.width);
        const style = value.style instanceof TokenReference
            ? refToCssVar(value.style)
            : value.style instanceof StrokeStyleObject ? "dashed" : value.style;
        const color = value.color instanceof TokenReference ? refToCssVar(value.color) : colorToCss(value.color, doc, base);
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
                if (isGradient) return gradientToCss(value, doc, base);
            }
        }
        if (value[0] instanceof ShadowLayer || value[0] instanceof TokenReference) {
            const parts = value.map((item) =>
                item instanceof ShadowLayer ? shadowLayerToCss(item, doc, base) : refToCssVar(item as TokenReference),
            );
            return parts.join(", ");
        }
        return value.map((f) =>
            f instanceof TokenReference ? refToCssVar(f) : `"${f}"`,
        ).join(", ");
    }

    if (value instanceof TypographyValue) return typographyToCss(value);

    return undefined;
}

function collectDeclarations(group: TokenGroup, path: TokenPath, doc: Dtcg, base?: Dtcg): TokenDeclaration[] {
    const result: TokenDeclaration[] = [];
    if (group.root !== undefined && path.toString()) {
        const css = tokenValueToCss(group.root.value, doc, base);
        if (css !== undefined) result.push(declare(path, group.root, css));
    }
    for (const [key, child] of group.entries()) {
        const childPath = path.child(key);
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, childPath, doc, base));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value, doc, base);
            if (css !== undefined) result.push(declare(childPath, child, css));
        }
    }
    return result;
}

function collectFromDoc(doc: Dtcg, base?: Dtcg): TokenDeclaration[] {
    const result: TokenDeclaration[] = [];
    for (const [key, child] of doc.entries()) {
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, TokenPath.of(key), doc, base));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value, doc, base);
            if (css !== undefined) result.push(declare(TokenPath.of(key), child, css));
        }
    }
    return result;
}

function materializeColor(color: ColorValue, doc: Dtcg, base?: Dtcg): ColorValue {
    const colorSpace = resolveColorProperty(color.colorSpace, doc, base);
    const components = resolveColorComponents(color.components, doc, base);
    const alpha = resolveColorProperty(color.alpha, doc, base);
    const hex = color.hex === undefined ? undefined : resolveColorProperty(color.hex, doc, base);

    if (typeof colorSpace !== "string" || !Array.isArray(components) || typeof alpha !== "number") {
        throw new Error("Color property references must resolve to a complete color value.");
    }

    return new ColorValue(
        colorSpace as ColorValue["colorSpace"],
        components as ColorValue["components"],
        alpha,
        typeof hex === "string" ? hex : undefined,
    );
}

function resolveColorComponents(value: unknown, doc: Dtcg, base?: Dtcg): unknown {
    const components = resolveColorProperty(value, doc, base);
    if (!Array.isArray(components)) return components;
    return components.map(component => resolveColorProperty(component, doc, base));
}

function resolveColorProperty(value: unknown, doc: Dtcg, base?: Dtcg): unknown {
    if (!(value instanceof TokenReference) || !value.isPropertyReference) return value;
    return doc.resolveReferenceValue(value, base);
}

function renderBlock(selector: string, declarations: Array<[string, string]>): string {
    if (declarations.length === 0) return "";
    const lines = declarations.map(([prop, val]) => `  ${prop}: ${val};`).join("\n");
    return `${selector} {\n${lines}\n}`;
}
