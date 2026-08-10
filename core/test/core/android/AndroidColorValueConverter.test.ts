import { describe, it, expect } from "vitest";
import { ColorValue } from "#/core/model/values/ColorValue";
import { AndroidColorValueConverter } from "#/core/platforms/android/AndroidColorValueConverter";

const converter = new AndroidColorValueConverter();

describe("AndroidColorValueConverter", () => {
    it("converts an opaque srgb color to #AARRGGBB", () => {
        const color = new ColorValue("srgb", [1, 0, 0], 1);
        expect(converter.convert(color)).toBe("#ffff0000");
    });

    it("puts the alpha channel first", () => {
        const color = new ColorValue("srgb", [0, 0, 0], 0.5);
        expect(converter.convert(color)).toBe("#80000000");
    });

    it("rounds channels to the nearest byte", () => {
        const color = new ColorValue("srgb", [0.5, 0.25, 0.75], 1);
        expect(converter.convert(color)).toBe("#ff8040bf");
    });

    it("clamps components outside the 0-1 range", () => {
        const color = new ColorValue("srgb", [2, -1, 0], 1);
        expect(converter.convert(color)).toBe("#ffff0000");
    });

    it("uses the hex fallback for color spaces without in-model conversion", () => {
        const color = new ColorValue("oklch", ["none", "none", "none"], 1, "#3366cc");
        expect(converter.convert(color)).toBe("#ff3366cc");
    });

    it("falls back to black when neither components nor hex are usable", () => {
        const color = new ColorValue("oklch", ["none"], 1);
        expect(converter.convert(color)).toBe("#ff000000");
    });
});
