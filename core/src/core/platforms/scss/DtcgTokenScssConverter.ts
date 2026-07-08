import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
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
import { ColorCssSerializer } from "#/core/platforms/css/ColorCssSerializer";
import type { TokenScssConverter } from "#/core/platforms/scss/TokenScssConverter";
import type { TokenScssOutput } from "#/core/platforms/scss/TokenScssOutput";

export interface DtcgTokenScssConverterOptions {
    /**
     * Separator used when flattening token paths into SCSS variable names.
     *
     * @defaultValue `"-"`
     */
    separator?: string;
}

const DEFAULT_SEPARATOR = "-";

/**
 * Converts token documents in any supported format to SCSS variables.
 *
 * @remarks
 * Base and theme documents are emitted as separate SCSS stylesheets. Theme
 * output keeps the same variable names as base and changes only the values.
 */
export class DtcgTokenScssConverter implements TokenScssConverter {
    readonly #loader = new DtcgListLoader();
    readonly #options: Required<DtcgTokenScssConverterOptions>;

    constructor(options: DtcgTokenScssConverterOptions = {}) {
        this.#options = {
            separator: options.separator ?? DEFAULT_SEPARATOR,
        };
    }

    async convert(sources: string[]): Promise<string> {
        const list = await this.#loader.load(sources);
        return this.convertList(list);
    }

    async convertThemes(sources: string[]): Promise<ReadonlyArray<TokenScssOutput>> {
        const list = await this.#loader.load(sources);
        return this.convertThemeList(list);
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        if (list.themes.size > 0) {
            throw new Error("SCSS multi-theme output produces multiple files; use convertThemes()");
        }

        const declarations = collectFromDoc(list.base, this.#options.separator);
        return renderDeclarations(declarations);
    }

    convertThemeList(list: DtcgList): ReadonlyArray<TokenScssOutput> {
        const outputs: TokenScssOutput[] = [{
            themeName: "base",
            isBase: true,
            content: renderDeclarations(collectFromDoc(list.base, this.#options.separator)),
        }];

        for (const [themeName, theme] of list.themes) {
            outputs.push({
                themeName,
                isBase: false,
                content: renderDeclarations(collectFromDoc(theme, this.#options.separator)),
            });
        }

        return outputs;
    }
}

const colorCssSerializer = new ColorCssSerializer();

function tokenPathToScssVar(path: string, separator: string): string {
    return `$${path.replace(/\./g, separator)}`;
}

function refToScssVar(ref: TokenReference, separator: string): string {
    return tokenPathToScssVar(ref.value, separator);
}

function colorToCss(color: ColorValue): string {
    return colorCssSerializer.serialize(color);
}

function dimensionOrRefToScss(value: DimensionValue | TokenReference, separator: string): string {
    if (value instanceof TokenReference) return refToScssVar(value, separator);
    return `${value.value}${value.unit}`;
}

function durationOrRefToScss(value: DurationValue | TokenReference, separator: string): string {
    if (value instanceof TokenReference) return refToScssVar(value, separator);
    return `${value.value}${value.unit}`;
}

function timingOrRefToScss(value: CubicBezierValue | TokenReference, separator: string): string {
    if (value instanceof TokenReference) return refToScssVar(value, separator);
    return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
}

function shadowLayerToScss(layer: ShadowLayer, separator: string): string {
    const inset = layer.inset ? "inset " : "";
    return `${inset}${dimensionOrRefToScss(layer.offsetX, separator)} ${dimensionOrRefToScss(layer.offsetY, separator)} ${dimensionOrRefToScss(layer.blur, separator)} ${dimensionOrRefToScss(layer.spread, separator)} ${layer.color instanceof TokenReference ? refToScssVar(layer.color, separator) : colorToCss(layer.color)}`;
}

function typographyToScss(value: TypographyValue, separator: string): string {
    const fontFamily = value.fontFamily instanceof TokenReference
        ? refToScssVar(value.fontFamily, separator)
        : Array.isArray(value.fontFamily)
            ? value.fontFamily
                .map((item) => item instanceof TokenReference ? refToScssVar(item, separator) : `"${item}"`)
                .join(", ")
            : `"${value.fontFamily}"`;
    const fontWeight = value.fontWeight instanceof TokenReference
        ? refToScssVar(value.fontWeight, separator)
        : String(value.fontWeight);
    const lineHeight = value.lineHeight instanceof TokenReference
        ? refToScssVar(value.lineHeight, separator)
        : String(value.lineHeight);

    return `${fontWeight} ${dimensionOrRefToScss(value.fontSize, separator)}/${lineHeight} ${fontFamily}`;
}

function gradientToScss(value: Array<GradientStop | TokenReference>, separator: string): string {
    const stops = value.map((stop) => {
        if (stop instanceof TokenReference) return refToScssVar(stop, separator);

        const color = stop.color instanceof TokenReference ? refToScssVar(stop.color, separator) : colorToCss(stop.color);
        const position = stop.position instanceof TokenReference
            ? `calc(${refToScssVar(stop.position, separator)} * 100%)`
            : `${stop.position * 100}%`;

        return `${color} ${position}`;
    });

    return `linear-gradient(180deg, ${stops.join(", ")})`;
}

function tokenValueToScss(value: unknown, separator: string): string | undefined {
    if (value instanceof TokenReference) return refToScssVar(value, separator);
    if (value instanceof ColorValue) return colorToCss(value);
    if (value instanceof DimensionValue) return `${value.value}${value.unit}`;
    if (value instanceof DurationValue) return `${value.value}${value.unit}`;
    if (value instanceof CubicBezierValue) return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;

    if (value instanceof ShadowLayer) return shadowLayerToScss(value, separator);

    if (value instanceof BorderValue) {
        const width = dimensionOrRefToScss(value.width, separator);
        const style = value.style instanceof TokenReference
            ? refToScssVar(value.style, separator)
            : value.style instanceof StrokeStyleObject ? "dashed" : value.style;
        const color = value.color instanceof TokenReference ? refToScssVar(value.color, separator) : colorToCss(value.color);
        return `${width} ${style} ${color}`;
    }

    if (value instanceof TransitionValue) {
        return `${durationOrRefToScss(value.duration, separator)} ${timingOrRefToScss(value.timingFunction, separator)} ${durationOrRefToScss(value.delay, separator)}`;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return undefined;
        if (value[0] instanceof GradientStop || (value[0] instanceof TokenReference && !(value[0] instanceof ShadowLayer))) {
            if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
                const isGradient = value.some((item) => item instanceof GradientStop);
                if (isGradient) return gradientToScss(value, separator);
            }
        }
        if (value[0] instanceof ShadowLayer || value[0] instanceof TokenReference) {
            const parts = value.map((item) =>
                item instanceof ShadowLayer ? shadowLayerToScss(item, separator) : refToScssVar(item as TokenReference, separator),
            );
            return parts.join(", ");
        }
        return value.map((item) =>
            item instanceof TokenReference ? refToScssVar(item, separator) : `"${item}"`,
        ).join(", ");
    }

    if (value instanceof TypographyValue) return typographyToScss(value, separator);

    return undefined;
}

function collectDeclarations(group: TokenGroup, path: TokenPath, separator: string): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of group.entries()) {
        const childPath = path.child(key);
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, childPath, separator));
        } else if (child instanceof TokenNode) {
            const scss = tokenValueToScss(child.value, separator);
            if (scss !== undefined) {
                result.push([tokenPathToScssVar(childPath.toString(), separator), scss]);
            }
        }
    }
    return result;
}

function collectFromDoc(doc: Dtcg, separator: string): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of doc.entries()) {
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, TokenPath.of(key), separator));
        } else if (child instanceof TokenNode) {
            const scss = tokenValueToScss(child.value, separator);
            if (scss !== undefined) result.push([tokenPathToScssVar(TokenPath.of(key).toString(), separator), scss]);
        }
    }
    return result;
}

function renderDeclarations(declarations: Array<[string, string]>): string {
    if (declarations.length === 0) return "";
    return `${declarations.map(([name, value]) => `${name}: ${value};`).join("\n")}\n`;
}
