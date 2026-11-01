import { describe, expect, it } from "vitest";
import { formatSrgbColor, toSrgbColor, type SrgbColor } from "#/core/audit/color/SrgbColor";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue, type ColorSpace } from "#/core/model/values/ColorValue";

function convert(colorSpace: ColorSpace, components: Array<number | "none">, alpha = 1, hex?: string): SrgbColor | undefined {
    return toSrgbColor(new ColorValue(colorSpace, components, alpha, hex));
}

function hex(color: SrgbColor | undefined): string | undefined {
    return color === undefined ? undefined : formatSrgbColor(color);
}

describe("toSrgbColor", () => {
    it("keeps sRGB components and alpha", () => {
        expect(convert("srgb", [0.2, 0.4, 0.6], 0.5)).toEqual({ red: 0.2, green: 0.4, blue: 0.6, alpha: 0.5 });
    });

    it("gamma-encodes linear sRGB", () => {
        expect(hex(convert("srgb-linear", [0.21586, 0.21586, 0.21586]))).toBe("#808080");
    });

    it.each<[ColorSpace, number[], string]>([
        ["hsl", [0, 100, 50], "#ff0000"],
        ["hsl", [120, 100, 25], "#008000"],
        ["hsl", [-120, 100, 50], "#0000ff"],
        ["hwb", [0, 0, 0], "#ff0000"],
        ["hwb", [0, 60, 60], "#808080"],
        ["oklab", [1, 0, 0], "#ffffff"],
        ["oklch", [0, 0, 0], "#000000"],
        ["oklch", [0.627955, 0.257683, 29.2339], "#ff0000"],
        ["lab", [100, 0, 0], "#ffffff"],
        ["lab", [0, 0, 0], "#000000"],
        ["lch", [54.2917, 106.839, 40.8526], "#ff0000"],
        ["xyz-d65", [0.95047, 1, 1.08883], "#ffffff"],
        ["xyz-d50", [0.96422, 1, 0.82521], "#ffffff"],
        ["display-p3", [1, 1, 1], "#ffffff"],
    ])("converts %s %j to %s", (colorSpace, components, expected) => {
        expect(hex(convert(colorSpace, components))).toBe(expected);
    });

    it("clips colors outside the sRGB gamut", () => {
        expect(hex(convert("display-p3", [1, 0, 0]))).toBe("#ff0000");
    });

    it("reads a missing component as zero", () => {
        expect(hex(convert("srgb", [1, "none", "none"]))).toBe("#ff0000");
    });

    it("falls back to hex for color spaces it does not convert", () => {
        expect(hex(convert("a98-rgb", [1, 0, 0], 1, "#ff0000"))).toBe("#ff0000");
        expect(convert("rec2020", [1, 0, 0])).toBeUndefined();
    });

    it("falls back to hex when the components cannot be read", () => {
        expect(hex(convert("srgb", [1, 0], 1, "#00ff00"))).toBe("#00ff00");
        expect(hex(convert("srgb", [Number.NaN, 0, 0], 1, "#0000ff"))).toBe("#0000ff");
        expect(convert("srgb", [1, 0])).toBeUndefined();
    });

    it("treats a color without a finite alpha as opaque", () => {
        expect(convert("srgb", [1, 0, 0], Number.NaN)?.alpha).toBe(1);
    });

    it("clamps alpha into range", () => {
        expect(convert("srgb", [1, 0, 0], 1.5)?.alpha).toBe(1);
        expect(convert("srgb", [1, 0, 0], -0.5)?.alpha).toBe(0);
    });

    it("cannot read a color holding a property reference", () => {
        const color = new ColorValue("srgb", new TokenReference("#/primitive/red/$value/components", "property"));
        expect(toSrgbColor(color)).toBeUndefined();
    });
});

describe("formatSrgbColor", () => {
    it("appends alpha for translucent colors", () => {
        expect(formatSrgbColor({ red: 0, green: 0, blue: 0, alpha: 0.5 })).toBe("#00000080");
        expect(formatSrgbColor({ red: 1, green: 1, blue: 1, alpha: 1 })).toBe("#ffffff");
    });
});
