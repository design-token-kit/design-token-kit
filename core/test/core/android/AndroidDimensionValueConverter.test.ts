import { describe, it, expect } from "vitest";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { AndroidDimensionValueConverter } from "#/core/platforms/android/AndroidDimensionValueConverter";

const converter = new AndroidDimensionValueConverter();

describe("AndroidDimensionValueConverter", () => {
    it("renders px as the requested unit", () => {
        expect(converter.convert(new DimensionValue(16, "px"), "dp")).toBe("16dp");
        expect(converter.convert(new DimensionValue(16, "px"), "sp")).toBe("16sp");
    });

    it("resolves rem against the default 16 pixel base", () => {
        expect(converter.convert(new DimensionValue(1.5, "rem"), "dp")).toBe("24dp");
    });

    it("resolves rem against a custom base", () => {
        const custom = new AndroidDimensionValueConverter(10);
        expect(custom.convert(new DimensionValue(1.5, "rem"), "dp")).toBe("15dp");
    });

    it("keeps fractional values", () => {
        expect(converter.convert(new DimensionValue(0.5, "px"), "dp")).toBe("0.5dp");
    });

    it("trims trailing precision noise", () => {
        expect(converter.convert(new DimensionValue(0.1, "rem"), "dp")).toBe("1.6dp");
    });

    it("resolves a dimension to its pixel magnitude", () => {
        expect(converter.toPixels(new DimensionValue(2, "rem"))).toBe(32);
        expect(converter.toPixels(new DimensionValue(8, "px"))).toBe(8);
    });
});
