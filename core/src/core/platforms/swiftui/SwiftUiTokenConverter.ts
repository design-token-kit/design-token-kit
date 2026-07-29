import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import type { TokenType } from "#/core/model/TokenType";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { SwiftUiColorValueConverter } from "#/core/platforms/swiftui/SwiftUiColorValueConverter";
import type { TokenConverter } from "#/core/platforms/TokenConverter";

/**
 * Output form for the generated SwiftUI source.
 */
export interface SwiftUiTokenConverterOptions {
    /**
     * Whether to emit tokens as a namespaced `enum` API or as a `Theme`
     * `struct` value on top of the enum layer.
     *
     * @defaultValue `"enum"`
     */
    swiftType?: "enum" | "struct";
}

/**
 * Converts DTCG token documents to a SwiftUI namespaced-enum API.
 *
 * @remarks
 * Groups become nested `enum`s; tokens become `static let`. References to
 * other tokens are preserved as Swift constant paths rooted at the current
 * enum namespace, not flattened to literal values.
 *
 * Themes are emitted as one full enum each: an overridden token carries its
 * value, a non-overridden token references the base enum. When `swiftType` is
 * `"struct"`, a `Theme` struct and one instance per theme are emitted on top,
 * with fields referencing the corresponding enum constants.
 */
export class SwiftUiTokenConverter implements TokenConverter {
    readonly #swiftType: "enum" | "struct";
    #used = new Set<CompositeKind>();

    constructor(options: SwiftUiTokenConverterOptions = {}) {
        this.#swiftType = options.swiftType ?? "enum";
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        this.#used = new Set();

        const enums: string[] = [this.#renderBaseEnum(list.base)];
        for (const [themeName, theme] of list.themes) {
            enums.push(this.#renderThemeEnum(list.base, theme, themeName));
        }

        const structLayer = this.#swiftType === "struct"
            ? this.#renderStructLayer(list)
            : undefined;

        const wrappers = [...this.#used].map((kind) => STRUCT_DEFINITIONS[kind]).join("\n\n");

        const source = list.base.source ?? "stdin";

        const doc: string[] = [
            `/// Swift representation of design tokens from \`${source}\`.`,
            "///",
            "/// ## Contents",
            "///",
        ];

        doc.push("/// - DesignTokens - base theme tokens (basic usage)");
        for (const themeName of list.themes.keys()) {
            doc.push(`/// - ${ROOT}${pascal(themeName)} - ${themeName} theme tokens (basic usage)`);
        }

        if (this.#swiftType === "struct") {
            doc.push("/// - Themes.base - base theme tokens (advanced usage)");
            for (const themeName of list.themes.keys()) {
                doc.push(`/// - Themes.${camel(themeName)} - ${themeName} theme tokens (advanced usage)`);
            }
        }

        doc.push(
            "///",
            "/// ### Usage",
            "///",
            "/// ```",
            "///   // Basic - enum constants",
            "///   Text(\"Hello\")",
            "///       .foregroundColor(DesignTokens.Color.Semantic.primary)",
            "///       .font(DesignTokens.Typography.body.font)",
            "///       .padding(DesignTokens.Space.insetMd)",
        );

        if (this.#swiftType === "struct") {
            doc.push(
                "///",
                "///   // Advanced - struct through Environment",
                "///   ContentView()",
                "///       .environment(\\.theme, Themes.dark)",
            );
        }

        doc.push(
            "/// ```",
            "///",
            "/// ### Legend",
            "///",
            "/// `enum DesignTokens`",
            "///     Token tree as enum constants. Groups become nested enums, tokens become",
            "///     typed `static let` properties. References between tokens are preserved",
            "///     as alias chains.",
        );

        if (list.themes.size > 0) {
            doc.push(
                "///",
                "///     Theme variants share the same structure with their own values:",
            );
            for (const themeName of list.themes.keys()) {
                doc.push(`///     - \`${ROOT}${pascal(themeName)}\` - ${themeName} theme`);
            }
        }

        if (this.#swiftType === "struct") {
            doc.push(
                "///",
                "/// `struct Theme`",
                "///     A single value holding all tokens for one theme. Enables switching",
                "///     themes at runtime through SwiftUI Environment.",
                "///",
                "/// `enum Themes`",
                "///     Collection of all theme instances. Each instance is assembled from its",
                "///     corresponding enum constants.",
            );
        }

        const DESIGN_TOKENS_DOC = doc.join("\n");

        const lines = ["// Auto-generated by design-token-kit. DO NOT EDIT.", "", "import SwiftUI", ""];
        lines.push(DESIGN_TOKENS_DOC, "");
        lines.push(enums.join("\n\n"));
        if (wrappers) lines.push("", wrappers);
        if (structLayer) lines.push("", structLayer);
        lines.push("");
        return lines.join("\n");
    }

    #renderBaseEnum(doc: Dtcg): string {
        currentRoot = ROOT;
        const body = this.#renderGroupBody(doc, 1);
        const desc = doc.root.description
            ? renderDocDescription(doc.root.description, 0)
            : "/// Base theme tokens.\n";
        return desc + wrapEnum(ROOT, body);
    }

    #renderThemeEnum(base: Dtcg, theme: Dtcg, themeName: string): string {
        const enumName = ROOT + pascal(themeName);
        currentRoot = enumName;
        const body = this.#renderThemeGroupBody(base.root, theme, [], 1);
        currentRoot = ROOT;
        return `/// ${themeName} theme.\n` + wrapEnum(enumName, body);
    }

    #renderGroupBody(group: Dtcg | TokenGroup, depth: number): string {
        const indent = INDENT.repeat(depth);
        const parts: string[] = [];
        for (const [key, child] of group.entries()) {
            if (child instanceof TokenGroup) {
                const desc = renderDocDescription(child.description, depth);
                const inner = this.#renderGroupBody(child, depth + 1);
                const enumLine = `${indent}enum ${pascal(key)} {`;
                const block = inner ? `${enumLine}\n${inner}\n${indent}}` : `${enumLine}\n${indent}}`;
                parts.push(desc + block);
            } else if (child instanceof TokenNode) {
                const desc = renderDocDescription(child.description, depth);
                const decl = this.#renderToken(camel(key), child.value, child.type);
                if (decl) parts.push(desc + `${indent}${decl}`);
            }
        }
        return parts.join("\n");
    }

    /**
     * Renders a theme enum body by mirroring the base tree. For each leaf, a
     * token overridden by the theme is rendered with its own value (rooted at
     * the current theme); a non-overridden token becomes a reference to the
     * base enum constant at the same path.
     */
    #renderThemeGroupBody(group: TokenGroup, theme: Dtcg, path: string[], depth: number): string {
        const indent = INDENT.repeat(depth);
        const parts: string[] = [];
        for (const [key, child] of group.entries()) {
            const childPath = [...path, key];
            if (child instanceof TokenGroup) {
                const desc = renderDocDescription(child.description, depth);
                const inner = this.#renderThemeGroupBody(child, theme, childPath, depth + 1);
                const enumLine = `${indent}enum ${pascal(key)} {`;
                const block = inner ? `${enumLine}\n${inner}\n${indent}}` : `${enumLine}\n${indent}}`;
                parts.push(desc + block);
            } else if (child instanceof TokenNode) {
                const desc = renderDocDescription(child.description, depth);
                const decl = this.#renderThemeLeaf(camel(key), child, theme, childPath);
                if (decl) parts.push(desc + `${indent}${decl}`);
            }
        }
        return parts.join("\n");
    }

    /**
     * Renders one leaf of a theme enum. A token overridden by the theme, or a
     * base token that is itself a reference, is rendered with its value rooted
     * at the current theme so overrides flow through it. A non-overridden
     * literal token becomes a reference to the base enum constant.
     */
    #renderThemeLeaf(name: string, base: TokenNode<unknown>, theme: Dtcg, path: string[]): string | undefined {
        const override = findTokenNode(theme, path);
        if (override) return this.#renderToken(name, override.value, override.type);
        if (base.value instanceof TokenReference) return this.#renderToken(name, base.value, base.type);
        return `static let ${name} = ${baseRefPath(path)}`;
    }

    #renderToken(name: string, value: unknown, type: TokenType | undefined): string | undefined {
        const rendered = this.#renderValue(value, type);
        if (!rendered) return undefined;
        return `static let ${name}${rendered.type ? `: ${rendered.type}` : ""} = ${rendered.expr}`;
    }

    #renderValue(value: unknown, type: TokenType | undefined): Rendered | undefined {
        if (value instanceof TokenReference) return { expr: refToSwift(value) };
        if (type === "strokeStyle") {
            this.#used.add("strokeStyle");
            return { expr: strokeStyleToSwift(value) };
        }
        const scalar = renderScalar(value);
        if (scalar) return scalar;
        return this.#renderComposite(value);
    }

    #renderComposite(value: unknown): Rendered | undefined {
        if (value instanceof TypographyValue) {
            this.#used.add("typography");
            return { expr: typographyToSwift(value) };
        }
        if (value instanceof BorderValue) {
            this.#used.add("border");
            return { expr: borderToSwift(value) };
        }
        if (value instanceof TransitionValue) {
            this.#used.add("transition");
            return { expr: transitionToSwift(value) };
        }
        if (value instanceof StrokeStyleObject) {
            this.#used.add("strokeStyle");
            return { expr: strokeStyleToSwift(value) };
        }
        if (value instanceof ShadowLayer) {
            this.#used.add("shadow");
            return { expr: `[${shadowLayerToSwift(value)}]`, type: "[ShadowToken]" };
        }
        if (Array.isArray(value) && value.length > 0) {
            return this.#renderArray(value);
        }
        return undefined;
    }

    #renderArray(value: unknown[]): Rendered | undefined {
        if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
            const hasGradient = value.some((item) => item instanceof GradientStop);
            if (hasGradient) return { expr: gradientToSwift(value as Array<GradientStop | TokenReference>) };
        }
        if (value.every((item) => item instanceof ShadowLayer || item instanceof TokenReference)
            && value.some((item) => item instanceof ShadowLayer)) {
            this.#used.add("shadow");
            const layers = value.map((item) =>
                item instanceof ShadowLayer ? shadowLayerToSwift(item) : refToSwift(item as TokenReference));
            return { expr: `[${layers.join(", ")}]`, type: "[ShadowToken]" };
        }
        if (value.every((item) => typeof item === "string" || item instanceof TokenReference)) {
            const items = value.map((item) =>
                item instanceof TokenReference ? refToSwift(item) : JSON.stringify(item));
            return { expr: `[${items.join(", ")}]`, type: "[String]" };
        }
        return undefined;
    }

    #renderStructLayer(list: DtcgList): string {
        const THEME_DOC = [
            "/// A single value holding all tokens for one theme.",
            "///",
            "/// Enables switching themes at runtime through SwiftUI Environment.",
        ].join("\n");

        const structDef = renderStructNamed(list.base.root, "Theme", 0);
        const instances = list.themes.size > 0
            ? this.#renderThemeInstances(list)
            : [this.#renderInstance("base", ROOT, list.base.root)];
        const themesBody = instances.map((line) => indentBlock(line, 1)).join("\n");
        const themesEnum = [`/// Theme instances.`, `enum Themes {`, themesBody, `}`].join("\n");
        return [THEME_DOC, structDef, "", themesEnum].join("\n");
    }

    #renderThemeInstances(list: DtcgList): string[] {
        const instances = [this.#renderInstance("base", ROOT, list.base.root)];
        for (const themeName of list.themes.keys()) {
            instances.push(this.#renderInstance(camel(themeName), ROOT + pascal(themeName), list.base.root));
        }
        return instances;
    }

    #renderInstance(instanceName: string, enumRoot: string, root: TokenGroup): string {
        const args = renderInstanceArgs(root, [], enumRoot, 1);
        return args
            ? `static let ${instanceName} = Theme(\n${args}\n)`
            : `static let ${instanceName} = Theme()`;
    }
}

interface Rendered {
    expr: string;
    type?: string;
}

type CompositeKind = "typography" | "shadow" | "border" | "strokeStyle" | "transition";

const ROOT = "DesignTokens";
const INDENT = "    ";

/**
 * The enum namespace the current render pass roots its references at.
 *
 * Reference rendering is stateless module-scope; this holds the "current root"
 * so intra-theme references point at the theme's own enum rather than the base.
 * It is set before rendering each enum body and always restored to {@link ROOT}.
 * Safe because rendering is synchronous and single-threaded.
 */
let currentRoot = ROOT;

const swiftUiColorValueConverter = new SwiftUiColorValueConverter();

const SWIFT_KEYWORDS = new Set([
    "default", "class", "enum", "struct", "case", "let", "var", "func",
    "import", "return", "self", "super", "static", "public", "internal",
    "private", "protocol", "extension", "if", "else", "for", "while",
    "switch", "true", "false", "nil", "in", "where", "guard", "defer",
]);

const STRUCT_DEFINITIONS: Record<CompositeKind, string> = {
    typography: [
        "/// Design token typography structure.",
        "///",
        "/// SwiftUI Font covers weight and size, not tracking or line spacing.",
        "struct TypographyToken {",
        `${INDENT}let font: SwiftUI.Font`,
        `${INDENT}let tracking: CGFloat`,
        `${INDENT}let lineSpacing: CGFloat`,
        "}",
    ].join("\n"),
    shadow: [
        "/// Design token shadow layer structure.",
        "///",
        "/// SwiftUI has no stand-alone shadow type, only the `.shadow()` modifier.",
        "struct ShadowToken {",
        `${INDENT}let color: SwiftUI.Color`,
        `${INDENT}let radius: CGFloat`,
        `${INDENT}let x: CGFloat`,
        `${INDENT}let y: CGFloat`,
        "}",
    ].join("\n"),
    border: [
        "/// Design token border structure.",
        "///",
        "/// SwiftUI has no stand-alone border type, only view modifiers.",
        "struct BorderToken {",
        `${INDENT}let color: SwiftUI.Color`,
        `${INDENT}let width: CGFloat`,
        "}",
    ].join("\n"),
    strokeStyle: [
        "/// Design token stroke style structure.",
        "///",
        "/// SwiftUI StrokeStyle is a drawing attribute, not a token value.",
        "struct StrokeStyleToken {",
        `${INDENT}let dashed: Bool`,
        "}",
    ].join("\n"),
    transition: [
        "/// Design token transition structure.",
        "///",
        "/// SwiftUI has no stand-alone transition type, only animation methods.",
        "struct TransitionToken {",
        `${INDENT}let duration: TimeInterval`,
        "}",
    ].join("\n"),
};

function renderDocDescription(description: string | undefined, depth: number): string {
    if (!description) return "";
    const indent = INDENT.repeat(depth);
    return description
        .split("\n")
        .map((line) => `${indent}/// ${line}`)
        .join("\n") + "\n";
}

function wrapEnum(name: string, body: string): string {
    const lines = [`enum ${name} {`];
    if (body) lines.push(body);
    lines.push("}");
    return lines.join("\n");
}

/**
 * Finds the token node at the given path in a document, or undefined when the
 * path is absent or resolves to a group.
 */
function findTokenNode(doc: Dtcg, path: string[]): TokenNode<unknown> | undefined {
    let node: TokenGroup | TokenNode<unknown> | undefined = doc.get(path[0]);
    for (let i = 1; i < path.length; i++) {
        if (!(node instanceof TokenGroup)) return undefined;
        node = node.get(path[i]);
    }
    return node instanceof TokenNode ? node : undefined;
}

/** Reference to the base enum constant at the given token path. */
function baseRefPath(path: string[]): string {
    const head = path.slice(0, -1).map(pascal);
    const tail = camel(path[path.length - 1]);
    return [ROOT, ...head, tail].join(".");
}

/**
 * Renders a nested struct type mirroring the token tree. Groups become nested
 * structs plus a field; leaves become typed fields. The top-level struct is
 * named `Theme`.
 */
function renderStructNamed(group: TokenGroup, name: string, depth: number): string {
    const indent = INDENT.repeat(depth);
    const inner = INDENT.repeat(depth + 1);
    const lines = [`${indent}struct ${name} {`];
    const fields: string[] = [];
    for (const [key, child] of group.entries()) {
        if (child instanceof TokenGroup) {
            lines.push(renderStructNamed(child, pascal(key), depth + 1));
            fields.push(`${inner}let ${camel(key)}: ${pascal(key)}`);
        } else if (child instanceof TokenNode) {
            const swiftType = fieldSwiftType(child);
            if (swiftType) fields.push(`${inner}let ${camel(key)}: ${swiftType}`);
        }
    }
    lines.push(...fields);
    lines.push(`${indent}}`);
    return lines.join("\n");
}

/**
 * Renders the argument list of a `Theme(...)` instance for one enum namespace.
 * Every field value is a reference to the enum constant at that path.
 */
function renderInstanceArgs(group: TokenGroup, path: string[], enumRoot: string, depth: number): string {
    const indent = INDENT.repeat(depth);
    const args: string[] = [];
    for (const [key, child] of group.entries()) {
        const childPath = [...path, key];
        if (child instanceof TokenGroup) {
            const inner = renderInstanceArgs(child, childPath, enumRoot, depth + 1);
            args.push(inner
                ? `${indent}${camel(key)}: .init(\n${inner}\n${indent})`
                : `${indent}${camel(key)}: .init()`);
        } else if (child instanceof TokenNode) {
            const swiftType = fieldSwiftType(child);
            if (swiftType) args.push(`${indent}${camel(key)}: ${enumRefPath(enumRoot, childPath)}`);
        }
    }
    return args.join(",\n");
}

/** Reference to a constant in the given enum namespace at the given path. */
function enumRefPath(enumRoot: string, path: string[]): string {
    const head = path.slice(0, -1).map(pascal);
    const tail = camel(path[path.length - 1]);
    return [enumRoot, ...head, tail].join(".");
}

/**
 * Swift field type for a leaf token, derived from its value. Returns undefined
 * for values that produce no declaration.
 */
function fieldSwiftType(node: TokenNode<unknown>): string | undefined {
    const value = node.value;
    if (value instanceof TokenReference) return referencedFieldType(node.type);
    if (value instanceof ColorValue) return "SwiftUI.Color";
    if (value instanceof DimensionValue) return "CGFloat";
    if (value instanceof DurationValue) return "TimeInterval";
    if (value instanceof CubicBezierValue) return "SwiftUI.UnitCurve";
    if (value instanceof TypographyValue) return "TypographyToken";
    if (value instanceof BorderValue) return "BorderToken";
    if (value instanceof TransitionValue) return "TransitionToken";
    if (value instanceof StrokeStyleObject) return "StrokeStyleToken";
    if (value instanceof ShadowLayer) return "[ShadowToken]";
    if (node.type === "strokeStyle") return "StrokeStyleToken";
    if (Array.isArray(value) && value.length > 0) return arrayFieldType(value);
    if (typeof value === "number") return "CGFloat";
    if (typeof value === "string") return "String";
    return undefined;
}

function arrayFieldType(value: unknown[]): string | undefined {
    if (value.some((item) => item instanceof GradientStop)) return "SwiftUI.Gradient";
    if (value.some((item) => item instanceof ShadowLayer)) return "[ShadowToken]";
    if (value.every((item) => typeof item === "string" || item instanceof TokenReference)) return "[String]";
    return undefined;
}

/** Field type for an alias token, derived from its declared type. */
function referencedFieldType(type: TokenType | undefined): string {
    const map: Partial<Record<TokenType, string>> = {
        color: "SwiftUI.Color",
        dimension: "CGFloat",
        duration: "TimeInterval",
        cubicBezier: "SwiftUI.UnitCurve",
        fontFamily: "[String]",
        typography: "TypographyToken",
        border: "BorderToken",
        transition: "TransitionToken",
        strokeStyle: "StrokeStyleToken",
        shadow: "[ShadowToken]",
        number: "CGFloat",
    };
    return (type && map[type]) ?? "SwiftUI.Color";
}

function renderScalar(value: unknown): Rendered | undefined {
    if (value instanceof TokenReference) return { expr: refToSwift(value) };
    if (value instanceof ColorValue) return { expr: swiftUiColorValueConverter.convert(value) };
    if (value instanceof DimensionValue) return { expr: String(value.value), type: "CGFloat" };
    if (value instanceof DurationValue) return { expr: String(durationSeconds(value)), type: "TimeInterval" };
    if (value instanceof CubicBezierValue) {
        return { expr: `SwiftUI.UnitCurve.bezier(startControlPoint: SwiftUI.UnitPoint(x: ${value.p1x}, y: ${value.p1y}), endControlPoint: SwiftUI.UnitPoint(x: ${value.p2x}, y: ${value.p2y}))` };
    }
    if (typeof value === "number") return { expr: String(value) };
    if (typeof value === "string") return { expr: JSON.stringify(value) };
    return undefined;
}

function durationSeconds(value: DurationValue): number {
    return value.unit === "ms" ? value.value / 1000 : value.value;
}

function refToSwift(ref: TokenReference): string {
    const segments = ref.path.segments();
    const head = segments.slice(0, -1).map(pascal);
    const tail = camel(segments[segments.length - 1]);
    return [currentRoot, ...head, tail].join(".");
}

function indentBlock(block: string, depth: number): string {
    const indent = INDENT.repeat(depth);
    return block.split("\n").map((line) => (line ? indent + line : line)).join("\n");
}

function dimToSwift(value: DimensionValue | TokenReference): string {
    if (value instanceof TokenReference) return refToSwift(value);
    return String(value.value);
}

function colorArgToSwift(value: ColorValue | TokenReference): string {
    return value instanceof TokenReference ? refToSwift(value) : swiftUiColorValueConverter.convert(value);
}

function typographyToSwift(value: TypographyValue): string {
    const size = dimToSwift(value.fontSize);
    const tracking = dimToSwift(value.letterSpacing);
    const lineSpacing = value.lineHeight instanceof TokenReference ? refToSwift(value.lineHeight) : String(value.lineHeight);
    const font = fontToSwift(value, size);
    return `TypographyToken(font: ${font}, tracking: ${tracking}, lineSpacing: ${lineSpacing})`;
}

function fontToSwift(value: TypographyValue, size: string): string {
    const family = concreteFontFamily(value.fontFamily);
    if (family !== undefined) {
        return `SwiftUI.Font.custom(${JSON.stringify(family)}, size: ${size})`;
    }
    const weight = fontWeightToSwift(value.fontWeight);
    return `SwiftUI.Font.system(size: ${size}, weight: ${weight})`;
}

function concreteFontFamily(fontFamily: TypographyValue["fontFamily"]): string | undefined {
    if (typeof fontFamily === "string") return fontFamily;
    if (Array.isArray(fontFamily)) {
        const first = fontFamily.find((entry) => typeof entry === "string");
        if (typeof first === "string") return first;
    }
    return undefined;
}

function fontWeightToSwift(weight: unknown): string {
    if (weight instanceof TokenReference) return refToSwift(weight);
    const map: Record<string, string> = {
        "100": ".ultraLight", "200": ".thin", "300": ".light", "400": ".regular",
        "500": ".medium", "600": ".semibold", "700": ".bold", "800": ".heavy", "900": ".black",
    };
    return map[String(weight)] ?? ".regular";
}

function shadowLayerToSwift(layer: ShadowLayer): string {
    const color = colorArgToSwift(layer.color);
    const radius = dimToSwift(layer.blur);
    const x = dimToSwift(layer.offsetX);
    const y = dimToSwift(layer.offsetY);
    return `ShadowToken(color: ${color}, radius: ${radius}, x: ${x}, y: ${y})`;
}

function strokeStyleToSwift(value: unknown): string {
    if (value instanceof StrokeStyleObject) {
        return `StrokeStyleToken(dashed: ${value.dashArray.length > 0})`;
    }
    const dashed = value === "dashed" || value === "dotted";
    return `StrokeStyleToken(dashed: ${dashed})`;
}

function borderToSwift(value: BorderValue): string {
    const color = colorArgToSwift(value.color);
    const width = dimToSwift(value.width);
    return `BorderToken(color: ${color}, width: ${width})`;
}

function transitionToSwift(value: TransitionValue): string {
    const duration = value.duration instanceof TokenReference
        ? refToSwift(value.duration)
        : String(durationSeconds(value.duration));
    return `TransitionToken(duration: ${duration})`;
}

function gradientToSwift(stops: Array<GradientStop | TokenReference>): string {
    const rendered = stops.map((stop) => {
        if (stop instanceof TokenReference) return `SwiftUI.Gradient.Stop(color: ${refToSwift(stop)}, location: 0)`;
        const color = colorArgToSwift(stop.color);
        const location = stop.position instanceof TokenReference ? refToSwift(stop.position) : String(stop.position);
        return `SwiftUI.Gradient.Stop(color: ${color}, location: ${location})`;
    });
    return `SwiftUI.Gradient(stops: [${rendered.join(", ")}])`;
}

function escapeIdentifier(name: string): string {
    return SWIFT_KEYWORDS.has(name) ? `${name}_` : name;
}

function pascal(segment: string): string {
    const cleaned = toParts(segment);
    return escapeIdentifier(cleaned.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(""));
}

function camel(segment: string): string {
    const cleaned = toParts(segment);
    const joined = cleaned
        .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join("");
    return escapeIdentifier(joined);
}

function toParts(segment: string): string[] {
    return segment.split(/[-_.\s]+/).filter(Boolean).map((p) => p.toLowerCase());
}
