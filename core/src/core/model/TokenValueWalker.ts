import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderValue } from "#/core/model/values/BorderValue";
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
    const emit = (field: unknown): void => {
        visit(field instanceof TokenReference ? { value: field, kind: "ref" } : { value: field, kind: "raw" });
    };

    if (value instanceof TokenReference) {
        visit({ value, kind: "ref" });
        return;
    }

    if (value instanceof BorderValue) {
        emit(value.color);
        emit(value.width);
        emit(value.style);
        if (value.style instanceof StrokeStyleObject) {
            for (const d of value.style.dashArray) emit(d);
        }
        return;
    }

    if (value instanceof TransitionValue) {
        emit(value.duration);
        emit(value.delay);
        emit(value.timingFunction);
        return;
    }

    if (value instanceof ShadowLayer) {
        emitShadowLayer(value, emit);
        return;
    }

    if (value instanceof GradientStop) {
        emit(value.color);
        emit(value.position);
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (item instanceof TokenReference) {
                visit({ value: item, kind: "ref" });
            } else if (item instanceof ShadowLayer) {
                emitShadowLayer(item, emit);
            } else if (item instanceof GradientStop) {
                emit(item.color);
                emit(item.position);
            } else {
                visit({ value: item, kind: "raw" });
            }
        }
        return;
    }

    if (value instanceof TypographyValue) {
        emit(value.fontSize);
        emit(value.fontWeight);
        emit(value.letterSpacing);
        emit(value.lineHeight);
        if (Array.isArray(value.fontFamily)) {
            for (const f of value.fontFamily) emit(f);
        } else {
            emit(value.fontFamily);
        }
        return;
    }

    // Plain primitive value (color, dimension, number, string, etc.).
    visit({ value, kind: "raw" });
}

function emitShadowLayer(layer: ShadowLayer, emit: (field: unknown) => void): void {
    emit(layer.color);
    emit(layer.offsetX);
    emit(layer.offsetY);
    emit(layer.blur);
    emit(layer.spread);
}
