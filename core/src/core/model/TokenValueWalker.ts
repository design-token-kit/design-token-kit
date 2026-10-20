import { TokenNode } from "#/core/model/TokenNode";
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

/**
 * A single leaf reached while walking a token value.
 *
 * A leaf is either a reference (an alias to another token) or a raw value
 * (a concrete primitive such as a color, dimension, number, string or keyword).
 * Composite values (border, shadow, gradient, transition, typography) are not
 * leaves: the walker descends into their fields and yields the leaves found there.
 */
export interface ValueLeaf {
    /**
     * The leaf value itself.
     * A {@link TokenReference} when {@link kind} is "ref", otherwise the raw primitive.
     */
    readonly value: unknown;

    /**
     * Whether this leaf is a reference or a concrete raw value.
     */
    readonly kind: "ref" | "raw";
}

/**
 * Callback invoked once per leaf, in traversal order.
 */
export type LeafVisitor = (leaf: ValueLeaf) => void;

/**
 * Walks a token's value and yields each reachable leaf in document order.
 *
 * @param token - The token whose value is walked.
 * @param visit - Callback invoked for each reference or raw leaf.
 */
export function walkTokenValue(token: TokenNode<unknown>, visit: LeafVisitor): void {
    walkValue(token.value, visit);
}

/**
 * Walks a bare token value and yields each reachable leaf in document order,
 * classifying it as a reference or a raw value.
 *
 * This is the single place that knows the structure of every DTCG value kind
 * (primitive, alias, border, transition, shadow, gradient, typography and their
 * arrays).
 * It carries no validation or lint policy: it does not resolve references,
 * inspect groups, dedup, or judge leaves.
 * Callers layer their own meaning on top of the emitted leaves.
 *
 * Adding a new composite value kind requires a single new branch here and
 * nowhere else.
 *
 * @param value - The token value to walk.
 * @param visit - Callback invoked for each reference or raw leaf.
 */
export function walkValue(value: unknown, visit: LeafVisitor): void {
    const walkField = (field: unknown): void => walkValue(field, visit);

    if (value instanceof TokenReference) {
        visit({ value, kind: "ref" });
        return;
    }

    if (value instanceof BorderValue) {
        walkField(value.color);
        walkField(value.width);
        const style = value.style;
        if (style instanceof StrokeStyleObject) {
            if (style.dashArray instanceof TokenReference) {
                walkField(style.dashArray);
            } else {
                for (const d of style.dashArray) walkField(d);
            }
            walkField(style.lineCap);
        } else {
            walkField(style);
        }
        return;
    }

    if (value instanceof ColorValue) {
        const colorSpace = value.colorSpace as unknown;
        const components = value.components as unknown;
        const hex = value.hex as unknown;
        const fields = [
            ...(colorSpace instanceof TokenReference ? [colorSpace] : []),
            ...(components instanceof TokenReference ? [components] : components as unknown[]),
            ...(value.alpha === 1 ? [] : [value.alpha as unknown]),
            ...(hex instanceof TokenReference ? [hex] : []),
        ];
        if (!fields.some(field => field instanceof TokenReference)) {
            visit({ value, kind: "raw" });
            return;
        }
        for (const field of fields) walkField(field);
        return;
    }

    if (value instanceof DimensionValue) {
        if (!(value.value instanceof TokenReference) && !(value.unit instanceof TokenReference)) {
            visit({ value, kind: "raw" });
            return;
        }
        walkField(value.value);
        walkField(value.unit);
        return;
    }

    if (value instanceof DurationValue) {
        if (!(value.value instanceof TokenReference) && !(value.unit instanceof TokenReference)) {
            visit({ value, kind: "raw" });
            return;
        }
        walkField(value.value);
        walkField(value.unit);
        return;
    }

    if (value instanceof CubicBezierValue) {
        const points = [value.p1x, value.p1y, value.p2x, value.p2y];
        if (!points.some(point => point instanceof TokenReference)) {
            visit({ value, kind: "raw" });
            return;
        }
        for (const point of points) walkField(point);
        return;
    }

    if (value instanceof TransitionValue) {
        walkField(value.duration);
        walkField(value.delay);
        walkField(value.timingFunction);
        return;
    }

    if (value instanceof ShadowLayer) {
        emitShadowLayer(value, walkField);
        if (value.inset !== false) walkField(value.inset);
        return;
    }

    if (value instanceof StrokeStyleObject) {
        const dashArray = value.dashArray;
        if (dashArray instanceof TokenReference) {
            walkField(dashArray);
        } else {
            for (const dash of dashArray) walkField(dash);
        }
        walkField(value.lineCap);
        return;
    }

    if (value instanceof GradientStop) {
        walkField(value.color);
        walkField(value.position);
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            walkField(item);
        }
        return;
    }

    if (value instanceof TypographyValue) {
        walkField(value.fontSize);
        walkField(value.fontWeight);
        walkField(value.letterSpacing);
        walkField(value.lineHeight);
        if (Array.isArray(value.fontFamily)) {
            for (const f of value.fontFamily) walkField(f);
        } else {
            walkField(value.fontFamily);
        }
        return;
    }

    // Plain primitive value (color, dimension, number, string, etc.).
    visit({ value, kind: "raw" });
}

function emitShadowLayer(layer: ShadowLayer, walkField: (field: unknown) => void): void {
    walkField(layer.color);
    walkField(layer.offsetX);
    walkField(layer.offsetY);
    walkField(layer.blur);
    walkField(layer.spread);
}
