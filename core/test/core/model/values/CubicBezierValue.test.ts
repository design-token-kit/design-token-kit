import { describe, it, expect } from "vitest";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";

describe("CubicBezierValue", () => {
    it("serializes to CSS cubic-bezier notation", () => {
        expect(new CubicBezierValue(0.4, 0, 0.2, 1).toString()).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
    });

    it("stores control point coordinates", () => {
        const cb = new CubicBezierValue(0.1, 0.2, 0.3, 0.4);
        expect(cb.p1x).toBe(0.1);
        expect(cb.p1y).toBe(0.2);
        expect(cb.p2x).toBe(0.3);
        expect(cb.p2y).toBe(0.4);
    });
});
