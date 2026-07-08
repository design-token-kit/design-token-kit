import { Dtcg } from "#/core/model/Dtcg";
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

type TailwindNamespace =
    | "background-image"
    | "breakpoint"
    | "color"
    | "duration"
    | "ease"
    | "font"
    | "font-weight"
    | "leading"
    | "radius"
    | "shadow"
    | "spacing"
    | "text"
    | "tracking";

export type TailwindDeclaration = {
    property: string;
    value: string;
};

type ExplicitTailwindNamespace = "breakpoint";

export interface TailwindTokenMapperOptions {
    colorCssSerializer?: ColorCssSerializer;
}

const TYPOGRAPHY_NAMESPACES: TailwindNamespace[] = [
    "font",
    "text",
    "font-weight",
    "tracking",
    "leading",
];

const TRANSITION_NAMESPACES: TailwindNamespace[] = [
    "duration",
    "ease",
];

const BREAKPOINT_SEGMENTS = new Set(["breakpoint", "breakpoints", "screen", "screens"]);
const RADIUS_SEGMENTS = new Set(["radius", "radii", "rounded", "rounding"]);

const STRIPPED_SEGMENTS: Record<TailwindNamespace, Set<string>> = {
    "background-image": new Set(["background-image", "backgroundImage", "gradient", "gradients"]),
    breakpoint: new Set(["breakpoint", "breakpoints", "screen", "screens"]),
    color: new Set(["color", "colors"]),
    duration: new Set(["duration", "durations", "motion", "transition", "transitions"]),
    ease: new Set(["cubic-bezier", "ease", "easing", "motion", "timing", "transition", "transitions"]),
    font: new Set(["font", "font-family", "fonts", "family", "text", "typography"]),
    "font-weight": new Set(["font", "font-weight", "fonts", "text", "typography", "weight"]),
    leading: new Set(["leading", "line-height", "lineHeight", "text", "typography"]),
    radius: new Set(["border-radius", "radius", "radii", "rounded", "rounding"]),
    shadow: new Set(["elevation", "shadow", "shadows"]),
    spacing: new Set(["dimension", "size", "sizes", "space", "spacing"]),
    text: new Set(["font-size", "size", "sizes", "text", "typography"]),
    tracking: new Set(["letter-spacing", "text", "tracking", "typography"]),
};

/**
 * Maps DTCG tokens to Tailwind CSS v4 theme custom properties.
 */
export class TailwindTokenMapper {
    readonly #colorCssSerializer: ColorCssSerializer;

    constructor(options: TailwindTokenMapperOptions = {}) {
        this.#colorCssSerializer = options.colorCssSerializer ?? new ColorCssSerializer({ mode: "tailwind" });
    }

    collectDocument(doc: Dtcg): TailwindDeclaration[] {
        const result: TailwindDeclaration[] = [];
        for (const [key, child] of doc.entries()) {
            const path = TokenPath.of(key);
            if (child instanceof TokenGroup) {
                result.push(...this.#collectGroup(child, path));
            } else if (child instanceof TokenNode) {
                result.push(...this.#mapToken(path, child));
            }
        }
        return result;
    }

    #collectGroup(group: TokenGroup, path: TokenPath): TailwindDeclaration[] {
        const result: TailwindDeclaration[] = [];
        for (const [key, child] of group.entries()) {
            const childPath = path.child(key);
            if (child instanceof TokenGroup) {
                result.push(...this.#collectGroup(child, childPath));
            } else if (child instanceof TokenNode) {
                result.push(...this.#mapToken(childPath, child));
            }
        }
        return result;
    }

    #mapToken(path: TokenPath, token: TokenNode<unknown>): TailwindDeclaration[] {
        if (token.type === "typography") {
            return this.#mapTypography(path, token.value);
        }
        if (token.type === "transition") {
            return this.#mapTransition(path, token.value);
        }

        const namespace = this.#resolveNamespace(path, token);
        if (!namespace) return [];

        const value = this.#tokenValueToCss(token.value, namespace);
        if (value === undefined) return [];

        return [{
            property: this.#buildPropertyName(namespace, path),
            value,
        }];
    }

    #mapTypography(path: TokenPath, value: unknown): TailwindDeclaration[] {
        if (value instanceof TokenReference) {
            return TYPOGRAPHY_NAMESPACES.map((namespace) => ({
                property: this.#buildPropertyName(namespace, path),
                value: this.#refToVar(value.path, namespace),
            }));
        }
        if (!(value instanceof TypographyValue)) return [];

        return [
            {
                property: this.#buildPropertyName("font", path),
                value: this.#fontFamilyToCss(value.fontFamily),
            },
            {
                property: this.#buildPropertyName("text", path),
                value: this.#dimensionOrRefToCss(value.fontSize, "text"),
            },
            {
                property: this.#buildPropertyName("font-weight", path),
                value: value.fontWeight instanceof TokenReference
                    ? this.#refToVar(value.fontWeight.path, "font-weight")
                    : String(value.fontWeight),
            },
            {
                property: this.#buildPropertyName("tracking", path),
                value: this.#dimensionOrRefToCss(value.letterSpacing, "tracking"),
            },
            {
                property: this.#buildPropertyName("leading", path),
                value: value.lineHeight instanceof TokenReference
                    ? this.#refToVar(value.lineHeight.path, "leading")
                    : String(value.lineHeight),
            },
        ];
    }

    #mapTransition(path: TokenPath, value: unknown): TailwindDeclaration[] {
        if (value instanceof TokenReference) {
            return TRANSITION_NAMESPACES.map((namespace) => ({
                property: this.#buildPropertyName(namespace, path),
                value: this.#refToVar(value.path, namespace),
            }));
        }
        if (!(value instanceof TransitionValue)) return [];

        return [
            {
                property: this.#buildPropertyName("duration", path),
                value: this.#durationOrRefToCss(value.duration),
            },
            {
                property: this.#buildPropertyName("ease", path),
                value: this.#timingOrRefToCss(value.timingFunction),
            },
        ];
    }

    #resolveNamespace(path: TokenPath, token: TokenNode<unknown>): TailwindNamespace | undefined {
        const explicitNamespace = this.#resolveExplicitNamespace(token);
        if (explicitNamespace) return explicitNamespace;

        const type = token.type;
        if (type === "color") return "color";
        if (type === "gradient") return "background-image";
        if (type === "dimension") {
            if (this.#pathHasSegment(path, BREAKPOINT_SEGMENTS)) return "breakpoint";
            if (this.#pathHasSegment(path, RADIUS_SEGMENTS)) return "radius";
            return "spacing";
        }
        if (type === "fontFamily") return "font";
        if (type === "fontWeight") return "font-weight";
        if (type === "duration") return "duration";
        if (type === "cubicBezier") return "ease";
        if (type === "shadow") return "shadow";
        if (type === "number" && this.#looksLikeFontWeight(path)) return "font-weight";
        return undefined;
    }

    #resolveExplicitNamespace(token: TokenNode<unknown>): ExplicitTailwindNamespace | undefined {
        const extension = token.extensions?.["design-token-kit"];
        if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
            return undefined;
        }

        const tailwindNamespace = (extension as Record<string, unknown>).tailwindNamespace;
        return tailwindNamespace === "breakpoint" ? tailwindNamespace : undefined;
    }

    #pathHasSegment(path: TokenPath, candidates: Set<string>): boolean {
        return path.segments().some((segment) => candidates.has(segment.toLowerCase()));
    }

    #looksLikeFontWeight(path: TokenPath): boolean {
        return path.segments().some((segment) => {
            const normalized = segment.toLowerCase();
            return normalized === "weight" || normalized === "font-weight";
        });
    }

    #buildPropertyName(namespace: TailwindNamespace, path: TokenPath): string {
        const keptSegments = path.segments().filter((segment) => !STRIPPED_SEGMENTS[namespace].has(segment.toLowerCase()));
        const suffix = (keptSegments.length > 0 ? keptSegments : path.segments()).join("-");
        return `--${namespace}-${suffix}`;
    }

    #refToVar(path: TokenPath, namespace: TailwindNamespace): string {
        return `var(${this.#buildPropertyName(namespace, path)})`;
    }

    #colorToCss(color: ColorValue): string {
        return this.#colorCssSerializer.serialize(color);
    }

    #fontFamilyToCss(value: TypographyValue["fontFamily"]): string {
        if (value instanceof TokenReference) return this.#refToVar(value.path, "font");
        if (Array.isArray(value)) {
            return value.map((item) => item instanceof TokenReference ? this.#refToVar(item.path, "font") : `"${item}"`).join(", ");
        }
        return `"${value}"`;
    }

    #dimensionOrRefToCss(
        value: DimensionValue | TokenReference,
        namespace: TailwindNamespace = "spacing",
    ): string {
        if (value instanceof TokenReference) return this.#refToVar(value.path, namespace);
        return `${value.value}${value.unit}`;
    }

    #durationOrRefToCss(value: DurationValue | TokenReference): string {
        if (value instanceof TokenReference) return this.#refToVar(value.path, "duration");
        return `${value.value}${value.unit}`;
    }

    #timingOrRefToCss(value: CubicBezierValue | TokenReference): string {
        if (value instanceof TokenReference) return this.#refToVar(value.path, "ease");
        return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
    }

    #shadowLayerToCss(layer: ShadowLayer): string {
        const inset = layer.inset ? "inset " : "";
        return `${inset}${this.#dimensionOrRefToCss(layer.offsetX)} ${this.#dimensionOrRefToCss(layer.offsetY)} ${this.#dimensionOrRefToCss(layer.blur)} ${this.#dimensionOrRefToCss(layer.spread)} ${layer.color instanceof TokenReference ? this.#refToVar(layer.color.path, "color") : this.#colorToCss(layer.color)}`;
    }

    #gradientToCss(value: Array<GradientStop | TokenReference>): string {
        const stops = value.map((stop) => {
            if (stop instanceof TokenReference) return this.#refToVar(stop.path, "color");

            const color = stop.color instanceof TokenReference ? this.#refToVar(stop.color.path, "color") : this.#colorToCss(stop.color);
            const position = stop.position instanceof TokenReference
                ? `calc(${this.#refToVar(stop.position.path, "spacing")} * 100%)`
                : `${stop.position * 100}%`;

            return `${color} ${position}`;
        });

        return `linear-gradient(180deg, ${stops.join(", ")})`;
    }

    #tokenValueToCss(value: unknown, namespace: TailwindNamespace): string | undefined {
        if (value instanceof TokenReference) return this.#refToVar(value.path, namespace);
        if (value instanceof ColorValue) return this.#colorToCss(value);
        if (value instanceof DimensionValue) return `${value.value}${value.unit}`;
        if (value instanceof DurationValue) return `${value.value}${value.unit}`;
        if (value instanceof CubicBezierValue) return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
        if (typeof value === "number") return String(value);
        if (typeof value === "string") return value;

        if (value instanceof ShadowLayer) return this.#shadowLayerToCss(value);

        if (value instanceof BorderValue) {
            const width = this.#dimensionOrRefToCss(value.width);
            const style = value.style instanceof TokenReference
                ? this.#refToVar(value.style.path, namespace)
                : value.style instanceof StrokeStyleObject ? "dashed" : value.style;
            const color = value.color instanceof TokenReference ? this.#refToVar(value.color.path, "color") : this.#colorToCss(value.color);
            return `${width} ${style} ${color}`;
        }

        if (value instanceof TransitionValue) return undefined;

        if (Array.isArray(value)) {
            if (value.length === 0) return undefined;
            if (value[0] instanceof GradientStop || value[0] instanceof TokenReference) {
                if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
                    const isGradient = value.some((item) => item instanceof GradientStop);
                    if (isGradient) return this.#gradientToCss(value);
                }
            }
            if (value[0] instanceof ShadowLayer || value[0] instanceof TokenReference) {
                return value.map((item) =>
                    item instanceof ShadowLayer ? this.#shadowLayerToCss(item) : this.#refToVar(item.path, namespace),
                ).join(", ");
            }
            return value.map((item) =>
                item instanceof TokenReference ? this.#refToVar(item.path, namespace) : `"${item}"`,
            ).join(", ");
        }

        if (value instanceof TypographyValue) return undefined;

        return undefined;
    }
}
