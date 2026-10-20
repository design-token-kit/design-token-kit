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
 * Resolves property-level JSON Pointer references for platform generators.
 *
 * DTCG output keeps property references intact. Platform formats require
 * concrete composite fields, so this clones only affected tokens and leaves
 * every other token, extension, and alias untouched.
 */
export function materializePropertyReferences(list: DtcgList): DtcgList {
    const base = materializeDocument(list.base, list.base);
    const themes = new Map<string, Dtcg>();

    for (const [name, theme] of list.themes) {
        const materializedTheme = materializeDocument(theme, theme, list.base);
        const effectiveBase = materializeDocument(list.base, theme, list.base);
        themes.set(name, addThemeMaterializations(materializedTheme, base, effectiveBase));
    }

    return new DtcgList(base, themes);
}

function materializeDocument(document: Dtcg, source: Dtcg, base?: Dtcg): Dtcg {
    const root = materializeGroup(document.root, source, base);
    return root === document.root ? document : new Dtcg(root, document.source);
}

function addThemeMaterializations(theme: Dtcg, base: Dtcg, effectiveBase: Dtcg): Dtcg {
    const additions: Array<{ path: string[]; token: TokenNode<unknown> }> = [];
    collectThemeMaterializations(base.root, effectiveBase.root, theme, [], additions);

    let result = theme;
    for (const addition of additions) {
        result = new Dtcg(insertToken(result.root, addition.path, addition.token), result.source);
    }
    return result;
}

function collectThemeMaterializations(
    base: TokenGroup,
    effectiveBase: TokenGroup,
    theme: Dtcg,
    path: string[],
    additions: Array<{ path: string[]; token: TokenNode<unknown> }>,
): void {
    if (effectiveBase.root !== undefined
        && (base.root === undefined || !tokensEqual(effectiveBase.root, base.root))
        && findToken(theme, [...path, "$root"]) === undefined) {
        additions.push({ path: [...path, "$root"], token: effectiveBase.root });
    }

    for (const [name, effectiveChild] of effectiveBase.entries()) {
        const baseChild = base.get(name);
        const childPath = [...path, name];
        if (effectiveChild instanceof TokenGroup) {
            if (baseChild instanceof TokenGroup) {
                collectThemeMaterializations(baseChild, effectiveChild, theme, childPath, additions);
            }
            continue;
        }
        if ((!(baseChild instanceof TokenNode) || !tokensEqual(effectiveChild, baseChild))
            && findToken(theme, childPath) === undefined) {
            additions.push({ path: childPath, token: effectiveChild });
        }
    }
}

function findToken(document: Dtcg, path: string[]): TokenNode<unknown> | undefined {
    let group = document.root;
    for (const [index, segment] of path.entries()) {
        if (segment === "$root") return index === path.length - 1 ? group.root : undefined;
        const child = group.get(segment);
        if (child instanceof TokenNode) return index === path.length - 1 ? child : undefined;
        if (!(child instanceof TokenGroup)) return undefined;
        group = child;
    }
    return undefined;
}

function insertToken(group: TokenGroup, path: string[], token: TokenNode<unknown>): TokenGroup {
    const [segment, ...rest] = path;
    if (segment === "$root") {
        return new TokenGroup({
            type: group.type,
            description: group.description,
            deprecated: group.deprecated,
            extensions: group.extensions,
            extends: group.extends,
            root: token,
            children: new Map(group.entries()),
        });
    }

    const existing = group.get(segment);
    const child = existing instanceof TokenGroup ? existing : new TokenGroup();
    const children = new Map(group.entries());
    if (rest.length === 0) {
        children.set(segment, token);
    } else {
        children.set(segment, insertToken(child, rest, token));
    }
    return new TokenGroup({
        type: group.type,
        description: group.description,
        deprecated: group.deprecated,
        extensions: group.extensions,
        extends: group.extends,
        root: group.root,
        children,
    });
}

function tokensEqual(left: TokenNode<unknown>, right: TokenNode<unknown>): boolean {
    return left.type === right.type && valuesEqual(left.value, right.value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (left instanceof TokenReference || right instanceof TokenReference) {
        return left instanceof TokenReference
            && right instanceof TokenReference
            && left.kind === right.kind
            && left.value === right.value;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((item, index) => valuesEqual(item, right[index]));
    }
    if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
        return false;
    }
    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key)
            && valuesEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
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
    if (resolvedType === undefined) {
        throw new Error(`Unable to infer token type for property reference: ${String(token.value)}`);
    }
    return cloneToken(token, value, resolvedType);
}

function materializeValue(
    value: unknown,
    source: Dtcg,
    base?: Dtcg,
    resolving = new Set<string>(),
): unknown {
    if (value instanceof TokenReference) {
        if (value.isTokenReference) {
            const target = source.resolveRef(value, base);
            if (target === undefined || !(target.node instanceof TokenNode)) {
                throw new Error(`Unresolved token reference: ${value.toString()}`);
            }
            return new TokenReference(target.path);
        }
        if (!value.isPropertyReference) return value;
        const key = referenceKey(value);
        if (resolving.has(key)) throw new Error(`Circular property reference: ${value.toString()}`);
        const nextResolving = new Set(resolving).add(key);
        return materializeValue(
            resolveReferencedValue(value, source, base, nextResolving),
            source,
            base,
            nextResolving,
        );
    }
    if (value instanceof ColorValue) return materializeColor(value, source, base, resolving);
    if (value instanceof DimensionValue) return materializeDimension(value, source, base, resolving);
    if (value instanceof DurationValue) return materializeDuration(value, source, base, resolving);
    if (value instanceof CubicBezierValue) return materializeCubicBezier(value, source, base, resolving);
    if (value instanceof BorderValue) return materializeBorder(value, source, base, resolving);
    if (value instanceof TransitionValue) return materializeTransition(value, source, base, resolving);
    if (value instanceof ShadowLayer) return materializeShadowLayer(value, source, base, resolving);
    if (value instanceof GradientStop) return materializeGradientStop(value, source, base, resolving);
    if (value instanceof StrokeStyleObject) return materializeStrokeStyle(value, source, base, resolving);
    if (value instanceof TypographyValue) return materializeTypography(value, source, base, resolving);
    if (Array.isArray(value)) return materializeArray(value, source, base, resolving);
    return value;
}

function materializeColor(color: ColorValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): ColorValue {
    const colorSpace = materializeValue(color.colorSpace, source, base, resolving);
    const components = materializeValue(color.components, source, base, resolving);
    const alpha = materializeValue(color.alpha, source, base, resolving);
    const hex = color.hex === undefined ? undefined : materializeValue(color.hex, source, base, resolving);

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

function materializeDimension(value: DimensionValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): DimensionValue {
    const dimension = materializeValue(value.value, source, base, resolving);
    const unit = materializeValue(value.unit, source, base, resolving);
    if (dimension === value.value && unit === value.unit) return value;
    if (typeof dimension !== "number" || typeof unit !== "string") {
        throw new Error("Dimension property references must resolve to a complete dimension value.");
    }
    return new DimensionValue(dimension, unit as DimensionValue["unit"]);
}

function materializeDuration(value: DurationValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): DurationValue {
    const duration = materializeValue(value.value, source, base, resolving);
    const unit = materializeValue(value.unit, source, base, resolving);
    if (duration === value.value && unit === value.unit) return value;
    if (typeof duration !== "number" || typeof unit !== "string") {
        throw new Error("Duration property references must resolve to a complete duration value.");
    }
    return new DurationValue(duration, unit as DurationValue["unit"]);
}

function materializeCubicBezier(
    value: CubicBezierValue,
    source: Dtcg,
    base: Dtcg | undefined,
    resolving: Set<string>,
): CubicBezierValue {
    const original = [value.p1x, value.p1y, value.p2x, value.p2y];
    const points = original.map(point => materializeValue(point, source, base, resolving));
    if (points.every((point, index) => point === original[index])) return value;
    if (!points.every(point => typeof point === "number")) {
        throw new Error("cubicBezier property references must resolve to numeric coordinates.");
    }
    return new CubicBezierValue(...points as [number, number, number, number]);
}

function materializeBorder(border: BorderValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): BorderValue {
    const color = materializeValue(border.color, source, base, resolving);
    const width = materializeValue(border.width, source, base, resolving);
    const style = materializeValue(border.style, source, base, resolving);
    if (color === border.color && width === border.width && style === border.style) return border;
    return new BorderValue(color as BorderValue["color"], width as BorderValue["width"], style as BorderValue["style"]);
}

function materializeTransition(value: TransitionValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): TransitionValue {
    const duration = materializeValue(value.duration, source, base, resolving);
    const delay = materializeValue(value.delay, source, base, resolving);
    const timingFunction = materializeValue(value.timingFunction, source, base, resolving);
    if (duration === value.duration && delay === value.delay && timingFunction === value.timingFunction) return value;
    return new TransitionValue(
        duration as TransitionValue["duration"],
        delay as TransitionValue["delay"],
        timingFunction as TransitionValue["timingFunction"],
    );
}

function materializeShadowLayer(value: ShadowLayer, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): ShadowLayer {
    const color = materializeValue(value.color, source, base, resolving);
    const offsetX = materializeValue(value.offsetX, source, base, resolving);
    const offsetY = materializeValue(value.offsetY, source, base, resolving);
    const blur = materializeValue(value.blur, source, base, resolving);
    const spread = materializeValue(value.spread, source, base, resolving);
    const inset = materializeValue(value.inset, source, base, resolving);
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

function materializeGradientStop(value: GradientStop, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): GradientStop {
    const color = materializeValue(value.color, source, base, resolving);
    const position = materializeValue(value.position, source, base, resolving);
    if (color === value.color && position === value.position) return value;
    return new GradientStop(color as GradientStop["color"], position as GradientStop["position"]);
}

function materializeStrokeStyle(value: StrokeStyleObject, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): StrokeStyleObject {
    const dashArray = materializeValue(value.dashArray, source, base, resolving);
    const lineCap = materializeValue(value.lineCap, source, base, resolving);
    if (dashArray === value.dashArray && lineCap === value.lineCap) return value;
    if (!Array.isArray(dashArray) || !dashArray.every(item => item instanceof DimensionValue)
        || typeof lineCap !== "string") {
        throw new Error("Stroke style property references must resolve to a complete stroke style value.");
    }
    return new StrokeStyleObject(dashArray, lineCap as StrokeStyleObject["lineCap"]);
}

function materializeTypography(value: TypographyValue, source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): TypographyValue {
    const fontFamily = materializeValue(value.fontFamily, source, base, resolving);
    const fontSize = materializeValue(value.fontSize, source, base, resolving);
    const fontWeight = materializeValue(value.fontWeight, source, base, resolving);
    const letterSpacing = materializeValue(value.letterSpacing, source, base, resolving);
    const lineHeight = materializeValue(value.lineHeight, source, base, resolving);
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

function materializeArray(value: unknown[], source: Dtcg, base: Dtcg | undefined, resolving: Set<string>): unknown[] {
    let changed = false;
    const result = value.map((item) => {
        const materialized = materializeValue(item, source, base, resolving);
        changed ||= materialized !== item;
        return materialized;
    });
    return changed ? result : value;
}

function resolveReferencedValue(
    value: TokenReference,
    source: Dtcg,
    base: Dtcg | undefined,
    resolving: Set<string>,
): unknown {
    const target = source.resolveReferenceValue(value, base);
    if (target === undefined) throw new Error(`Unresolved property reference: ${value.toString()}`);
    if (!(target instanceof TokenReference)) return target;
    const key = referenceKey(target);
    if (resolving.has(key)) throw new Error(`Circular property reference: ${target.toString()}`);
    return resolveReferencedValue(target, source, base, new Set(resolving).add(key));
}

function resolveReferenceType(value: unknown, source: Dtcg, base?: Dtcg): TokenType | undefined {
    if (!(value instanceof TokenReference) || (!value.isPropertyReference && !value.isTokenReference)) return undefined;
    if (value.isPropertyReference) {
        if (pointsToTokenValue(value)) {
            const target = source.resolveRef(value, base);
            if (target?.node instanceof TokenNode && target.node.type !== undefined) return target.node.type;
        }
        const resolved = resolveReferencedValue(value, source, base, new Set([referenceKey(value)]));
        return inferTokenType(resolved);
    }
    const target = source.resolveChain(value, base);
    return target instanceof TokenNode ? target.type : undefined;
}

function referenceKey(value: TokenReference): string {
    return `${value.isPropertyReference ? "pointer" : value.isTokenReference ? "token" : "alias"}:${value.value}`;
}

function pointsToTokenValue(value: TokenReference): boolean {
    if (value.pointer === undefined) return false;
    try {
        const segments = value.pointer.slice(2).split("/").map((segment) =>
            decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~"),
        );
        return segments[segments.length - 1] === "$value";
    } catch {
        return false;
    }
}

function inferTokenType(value: unknown): TokenType | undefined {
    if (value instanceof ColorValue) return "color";
    if (value instanceof DimensionValue) return "dimension";
    if (value instanceof DurationValue) return "duration";
    if (value instanceof CubicBezierValue) return "cubicBezier";
    if (value instanceof BorderValue) return "border";
    if (value instanceof TransitionValue) return "transition";
    if (value instanceof ShadowLayer) return "shadow";
    if (value instanceof StrokeStyleObject) return "strokeStyle";
    if (value instanceof TypographyValue) return "typography";
    if (typeof value === "number") return "number";
    if (Array.isArray(value)) {
        if (value.some(item => item instanceof ShadowLayer)
            && value.every(item => item instanceof ShadowLayer || item instanceof TokenReference)) return "shadow";
        if (value.some(item => item instanceof GradientStop)
            && value.every(item => item instanceof GradientStop || item instanceof TokenReference)) return "gradient";
        if (value.every(item => typeof item === "string")) return "fontFamily";
    }
    return undefined;
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
