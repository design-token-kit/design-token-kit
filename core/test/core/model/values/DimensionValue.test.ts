import { describe, it, expect } from "vitest";
import { DEFAULT_REM_BASE, DimensionValue } from "#/core/model/values/DimensionValue";

describe("DimensionValue", () => {
    it.each([
        [4, "px", "4px"],
        [1.5, "rem", "1.5rem"],
        [0, "px", "0px"],
    ] as const)("serializes %s%s to %s", (value, unit, expected) => {
        expect(new DimensionValue(value, unit).toString()).toBe(expected);
    });

    describe("toPixels", () => {
        it("expands rem against the default base", () => {
            expect(new DimensionValue(1.5, "rem").toPixels()).toBe(24);
        });

        it("expands rem against an explicit base", () => {
            expect(new DimensionValue(1.5, "rem").toPixels(10)).toBe(15);
        });

        it("leaves px untouched whatever the base", () => {
            expect(new DimensionValue(24, "px").toPixels(10)).toBe(24);
        });

        it("defaults to the CSS root font size", () => {
            expect(DEFAULT_REM_BASE).toBe(16);
        });
    });
});
