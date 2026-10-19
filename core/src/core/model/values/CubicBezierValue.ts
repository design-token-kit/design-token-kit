/**
 * Represents a CSS cubic-bezier timing function with two control points P1 and P2.
 *
 * P0 is implicitly (0, 0) and P3 is implicitly (1, 1).
 * X coordinates must be in [0, 1]; Y coordinates are unbounded.
 *
 * @see https://tr.designtokens.org/format/#cubic-bezier
 */
export class CubicBezierValue {
    /** X coordinate of control point P1, in range [0, 1]. */
    readonly p1x: number | TokenReference;
    /** Y coordinate of control point P1. */
    readonly p1y: number | TokenReference;
    /** X coordinate of control point P2, in range [0, 1]. */
    readonly p2x: number | TokenReference;
    /** Y coordinate of control point P2. */
    readonly p2y: number | TokenReference;

    constructor(
        p1x: number | TokenReference,
        p1y: number | TokenReference,
        p2x: number | TokenReference,
        p2y: number | TokenReference,
    ) {
        this.p1x = p1x;
        this.p1y = p1y;
        this.p2x = p2x;
        this.p2y = p2y;
    }

    toString(): string {
        if ([this.p1x, this.p1y, this.p2x, this.p2y].some(value => value instanceof TokenReference)) {
            throw new Error("Cannot stringify a cubicBezier containing a property reference.");
        }
        return `cubic-bezier(${this.p1x}, ${this.p1y}, ${this.p2x}, ${this.p2y})`;
    }
}

/** Returns true when all cubicBezier coordinates are concrete numbers. */
export function isConcreteCubicBezierValue(
    value: CubicBezierValue,
): value is CubicBezierValue & {
    readonly p1x: number;
    readonly p1y: number;
    readonly p2x: number;
    readonly p2y: number;
} {
    return [value.p1x, value.p1y, value.p2x, value.p2y].every(point => typeof point === "number");
}
import { TokenReference } from "#/core/model/TokenReference";
