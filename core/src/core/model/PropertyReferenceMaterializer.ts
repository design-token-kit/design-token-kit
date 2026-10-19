import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import type { TokenType } from "#/core/model/TokenType";
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
 * Resolves color property-level JSON Pointer references for platform generators.
 *
 * DTCG output keeps property references intact. Platform color formats require
 * concrete channels, so this clones only affected color tokens and leaves every
 * other token, extension, and alias untouched.
 */
export function materializePropertyReferences(list: DtcgList): DtcgList {
    const base = materializeDocument(list.base, list.base);
    const themes = new Map<string, Dtcg>();

    for (const [name, theme] of list.themes) {
        themes.set(name, materializeDocument(theme, theme, list.base));
    }

    return new DtcgList(base, themes);
}

function materializeDocument(document: Dtcg, source: Dtcg, base?: Dtcg): Dtcg {
    const root = materializeGroup(document.root, source, base);
    return root === document.root ? document : new Dtcg(root, document.source);
}

function materializeGroup(group: TokenGroup, source: Dtcg, base?: Dtcg): TokenGroup {
    let changed = false;
    const children = new Map<string, TokenGroup | TokenNode<unknown>>();

    for (const [name, child] of group.entries()) {
        const materialized = child instanceof TokenGroup
            ? materializeGroup(child, source, base)
            : materializeToken(child, source, base);
        children.set(name, materialized);
        changed ||= materialized !== child;
    }

    const root = group.root === undefined ? undefined : materializeToken(group.root, source, base);
    changed ||= root !== group.root;
    if (!changed) return group;

    return new TokenGroup({
        type: group.type,
        description: group.description,
        deprecated: group.deprecated,
        extensions: group.extensions,
        extends: group.extends,
        root,
        children,
    });
}

function materializeToken(token: TokenNode<unknown>, source: Dtcg, base?: Dtcg): TokenNode<unknown> {
    const value = materializeValue(token.value, source, base);
    if (value === token.value) return token;
    const resolvedType = token.type ?? resolveReferenceType(token.value, source, base);
    return cloneToken(token, value, resolvedType);
}

function materializeValue(value: unknown, source: Dtcg, base?: Dtcg): unknown {
    if (value instanceof TokenReference) {
        if (value.isTokenReference) {
            const target = source.resolveRef(value, base);
            if (target === undefined || !(target.node instanceof TokenNode)) {
                throw new Error(`Unresolved token reference: ${value.toString()}`);
            }
            return new TokenReference(target.path);
        }
        if (!value.isPropertyReference) return value;
        return materializeValue(resolveReference(value, source, base), source, base);
    }
    if (value instanceof ColorValue) return materializeColor(value, source, base);
    if (value instanceof DimensionValue) return materializeDimension(value, source, base);
    if (value instanceof DurationValue) return materializeDuration(value, source, base);
    if (value instanceof CubicBezierValue) return materializeCubicBezier(value, source, base);
    if (value instanceof BorderValue) return materializeBorder(value, source, base);
    if (value instanceof TransitionValue) return materializeTransition(value, source, base);
    if (value instanceof ShadowLayer) return materializeShadowLayer(value, source, base);
    if (value instanceof GradientStop) return materializeGradientStop(value, source, base);
    if (value instanceof StrokeStyleObject) return materializeStrokeStyle(value, source, base);
    if (value instanceof TypographyValue) return materializeTypography(value, source, base);
    if (Array.isArray(value)) return materializeArray(value, source, base);
    return value;
}

function materializeColor(color: ColorValue, source: Dtcg, base?: Dtcg): ColorValue {
    const colorSpace = materializeValue(color.colorSpace, source, base);
    const components = materializeValue(color.components, source, base);
    const alpha = materializeValue(color.alpha, source, base);
    const hex = color.hex === undefined ? undefined : materializeValue(color.hex, source, base);

    if (colorSpace === color.colorSpace && components === color.components && alpha === color.alpha && hex === color.hex) {
        return color;
    }
    if (typeof colorSpace !== "string" || !Array.isArray(components)
        || !components.every(component => typeof component === "number" || component === "none")
        || typeof alpha !== "number"
        || (color.hex !== undefined && typeof hex !== "string")) {
        throw new Error("Color property references must resolve to a complete color value.");
    }

    return new ColorValue(
        colorSpace as ColorValue["colorSpace"],
        components,
        alpha,
        typeof hex === "string" ? hex : undefined,
    );
}

function materializeDimension(value: DimensionValue, source: Dtcg, base?: Dtcg): DimensionValue {
    const dimension = materializeValue(value.value, source, base);
    const unit = materializeValue(value.unit, source, base);
    if (dimension === value.value && unit === value.unit) return value;
    if (typeof dimension !== "number" || typeof unit !== "string") {
        throw new Error("Dimension property references must resolve to a complete dimension value.");
    }
    return new DimensionValue(dimension, unit as DimensionValue["unit"]);
}

function materializeDuration(value: DurationValue, source: Dtcg, base?: Dtcg): DurationValue {
    const duration = materializeValue(value.value, source, base);
    const unit = materializeValue(value.unit, source, base);
    if (duration === value.value && unit === value.unit) return value;
    if (typeof duration !== "number" || typeof unit !== "string") {
        throw new Error("Duration property references must resolve to a complete duration value.");
    }
    return new DurationValue(duration, unit as DurationValue["unit"]);
}

function materializeCubicBezier(value: CubicBezierValue, source: Dtcg, base?: Dtcg): CubicBezierValue {
    const original = [value.p1x, value.p1y, value.p2x, value.p2y];
    const points = original.map(point => materializeValue(point, source, base));
    if (points.every((point, index) => point === original[index])) return value;
    if (!points.every(point => typeof point === "number")) {
        throw new Error("cubicBezier property references must resolve to numeric coordinates.");
    }
    return new CubicBezierValue(...points as [number, number, number, number]);
}

function materializeBorder(border: BorderValue, source: Dtcg, base?: Dtcg): BorderValue {
    const color = materializeValue(border.color, source, base);
    const width = materializeValue(border.width, source, base);
    const style = materializeValue(border.style, source, base);
    if (color === border.color && width === border.width && style === border.style) return border;
    return new BorderValue(color as BorderValue["color"], width as BorderValue["width"], style as BorderValue["style"]);
}

function materializeTransition(value: TransitionValue, source: Dtcg, base?: Dtcg): TransitionValue {
    const duration = materializeValue(value.duration, source, base);
    const delay = materializeValue(value.delay, source, base);
    const timingFunction = materializeValue(value.timingFunction, source, base);
    if (duration === value.duration && delay === value.delay && timingFunction === value.timingFunction) return value;
    return new TransitionValue(
        duration as TransitionValue["duration"],
        delay as TransitionValue["delay"],
        timingFunction as TransitionValue["timingFunction"],
    );
}

function materializeShadowLayer(value: ShadowLayer, source: Dtcg, base?: Dtcg): ShadowLayer {
    const color = materializeValue(value.color, source, base);
    const offsetX = materializeValue(value.offsetX, source, base);
    const offsetY = materializeValue(value.offsetY, source, base);
    const blur = materializeValue(value.blur, source, base);
    const spread = materializeValue(value.spread, source, base);
    const inset = materializeValue(value.inset, source, base);
    if (color === value.color && offsetX === value.offsetX && offsetY === value.offsetY
        && blur === value.blur && spread === value.spread && inset === value.inset) {
        return value;
    }
    if (typeof inset !== "boolean") {
        throw new Error("Shadow property references must resolve to a boolean inset value.");
    }
    return new ShadowLayer(
        color as ShadowLayer["color"],
        offsetX as ShadowLayer["offsetX"],
        offsetY as ShadowLayer["offsetY"],
        blur as ShadowLayer["blur"],
        spread as ShadowLayer["spread"],
        inset,
    );
}

function materializeGradientStop(value: GradientStop, source: Dtcg, base?: Dtcg): GradientStop {
    const color = materializeValue(value.color, source, base);
    const position = materializeValue(value.position, source, base);
    if (color === value.color && position === value.position) return value;
    return new GradientStop(color as GradientStop["color"], position as GradientStop["position"]);
}

function materializeStrokeStyle(value: StrokeStyleObject, source: Dtcg, base?: Dtcg): StrokeStyleObject {
    const dashArray = materializeValue(value.dashArray, source, base);
    const lineCap = materializeValue(value.lineCap, source, base);
    if (dashArray === value.dashArray && lineCap === value.lineCap) return value;
    if (!Array.isArray(dashArray) || !dashArray.every(item => item instanceof DimensionValue)
        || typeof lineCap !== "string") {
        throw new Error("Stroke style property references must resolve to a complete stroke style value.");
    }
    return new StrokeStyleObject(dashArray, lineCap as StrokeStyleObject["lineCap"]);
}

function materializeTypography(value: TypographyValue, source: Dtcg, base?: Dtcg): TypographyValue {
    const fontFamily = materializeValue(value.fontFamily, source, base);
    const fontSize = materializeValue(value.fontSize, source, base);
    const fontWeight = materializeValue(value.fontWeight, source, base);
    const letterSpacing = materializeValue(value.letterSpacing, source, base);
    const lineHeight = materializeValue(value.lineHeight, source, base);
    if (fontFamily === value.fontFamily && fontSize === value.fontSize && fontWeight === value.fontWeight
        && letterSpacing === value.letterSpacing && lineHeight === value.lineHeight) {
        return value;
    }
    return new TypographyValue(
        fontFamily as TypographyValue["fontFamily"],
        fontSize as TypographyValue["fontSize"],
        fontWeight as TypographyValue["fontWeight"],
        letterSpacing as TypographyValue["letterSpacing"],
        lineHeight as TypographyValue["lineHeight"],
    );
}

function materializeArray(value: unknown[], source: Dtcg, base?: Dtcg): unknown[] {
    let changed = false;
    const result = value.map((item) => {
        const materialized = materializeValue(item, source, base);
        changed ||= materialized !== item;
        return materialized;
    });
    return changed ? result : value;
}

function resolveReference(value: TokenReference, source: Dtcg, base: Dtcg | undefined, resolving = new Set<string>()): unknown {
    const key = `${value.isPropertyReference ? "pointer" : "alias"}:${value.value}`;
    if (resolving.has(key)) throw new Error(`Circular property reference: ${value.toString()}`);
    const target = source.resolveReferenceValue(value, base);
    if (target === undefined) throw new Error(`Unresolved property reference: ${value.toString()}`);
    if (!(target instanceof TokenReference)) return target;
    return resolveReference(target, source, base, new Set(resolving).add(key));
}

function resolveReferenceType(value: unknown, source: Dtcg, base?: Dtcg): TokenType | undefined {
    if (!(value instanceof TokenReference) || (!value.isPropertyReference && !value.isTokenReference)) return undefined;
    const target = source.resolveChain(value, base);
    return target instanceof TokenNode ? target.type : undefined;
}

function cloneToken(token: TokenNode<unknown>, value: unknown, type: TokenType | undefined): TokenNode<unknown> {
    const metadata = [token.description, token.deprecated, token.extensions] as const;
    switch (type) {
        case "color": return new ColorToken(value as ConstructorParameters<typeof ColorToken>[0], ...metadata);
        case "dimension": return new DimensionToken(value as ConstructorParameters<typeof DimensionToken>[0], ...metadata);
        case "fontFamily": return new FontFamilyToken(value as ConstructorParameters<typeof FontFamilyToken>[0], ...metadata);
        case "fontWeight": return new FontWeightToken(value as ConstructorParameters<typeof FontWeightToken>[0], ...metadata);
        case "number": return new NumberToken(value as ConstructorParameters<typeof NumberToken>[0], ...metadata);
        case "duration": return new DurationToken(value as ConstructorParameters<typeof DurationToken>[0], ...metadata);
        case "cubicBezier": return new CubicBezierToken(value as ConstructorParameters<typeof CubicBezierToken>[0], ...metadata);
        case "strokeStyle": return new StrokeStyleToken(value as ConstructorParameters<typeof StrokeStyleToken>[0], ...metadata);
        case "border": return new BorderToken(value as ConstructorParameters<typeof BorderToken>[0], ...metadata);
        case "transition": return new TransitionToken(value as ConstructorParameters<typeof TransitionToken>[0], ...metadata);
        case "shadow": return new ShadowToken(value as ConstructorParameters<typeof ShadowToken>[0], ...metadata);
        case "gradient": return new GradientToken(value as ConstructorParameters<typeof GradientToken>[0], ...metadata);
        case "typography": return new TypographyToken(value as ConstructorParameters<typeof TypographyToken>[0], ...metadata);
        default: return token;
    }
}
