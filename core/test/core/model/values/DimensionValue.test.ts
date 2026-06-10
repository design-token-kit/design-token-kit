import { describe, it, expect } from "vitest";
import { DimensionValue } from "#/core/model/values/DimensionValue";

describe("DimensionValue", () => {
    it.each([
        [4, "px", "4px"],
        [1.5, "rem", "1.5rem"],
        [0, "px", "0px"],
    ] as const)("serializes %s%s to %s", (value, unit, expected) => {
        expect(new DimensionValue(value, unit).toString()).toBe(expected);
    });
});
