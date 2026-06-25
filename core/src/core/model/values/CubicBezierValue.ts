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
    readonly p1x: number;
    /** Y coordinate of control point P1. */
    readonly p1y: number;
    /** X coordinate of control point P2, in range [0, 1]. */
    readonly p2x: number;
    /** Y coordinate of control point P2. */
    readonly p2y: number;

    constructor(p1x: number, p1y: number, p2x: number, p2y: number) {
        this.p1x = p1x;
        this.p1y = p1y;
        this.p2x = p2x;
        this.p2y = p2y;
    }

    toString(): string {
        return `cubic-bezier(${this.p1x}, ${this.p1y}, ${this.p2x}, ${this.p2y})`;
    }
}
