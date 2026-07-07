import { describe, it, expect } from "vitest";
import { ColorCssSerializer } from "#/core/css/ColorCssSerializer";
import { ColorValue } from "#/core/model/values/ColorValue";

describe("ColorCssSerializer", () => {
    const serializer = new ColorCssSerializer();
    const tailwindSerializer = new ColorCssSerializer({ mode: "tailwind" });

    describe("hex shortcut", () => {
        it("returns hex when hex is set and alpha is 1", () => {
            const color = new ColorValue("srgb", [1, 0, 0], 1, "#ff0000");
            expect(serializer.serialize(color)).toBe("#ff0000");
        });

        it("ignores hex when alpha is not 1", () => {
            const color = new ColorValue("srgb", [1, 0, 0], 0.5, "#ff0000");
            expect(serializer.serialize(color)).toBe("color(srgb 1 0 0 / 0.5)");
        });
    });

    describe("color() function spaces", () => {
        it("serializes srgb", () => {
            const color = new ColorValue("srgb", [1, 0.5, 0]);
            expect(serializer.serialize(color)).toBe("color(srgb 1 0.5 0)");
        });

        it("serializes srgb-linear", () => {
            const color = new ColorValue("srgb-linear", [0.2, 0.4, 0.8]);
            expect(serializer.serialize(color)).toBe("color(srgb-linear 0.2 0.4 0.8)");
        });

        it("serializes display-p3", () => {
            const color = new ColorValue("display-p3", [0.3, 0.6, 0.9]);
            expect(serializer.serialize(color)).toBe("color(display-p3 0.3 0.6 0.9)");
        });

        it("serializes a98-rgb", () => {
            const color = new ColorValue("a98-rgb", [0.1, 0.2, 0.3]);
            expect(serializer.serialize(color)).toBe("color(a98-rgb 0.1 0.2 0.3)");
        });

        it("serializes prophoto-rgb", () => {
            const color = new ColorValue("prophoto-rgb", [0.5, 0.5, 0.5]);
            expect(serializer.serialize(color)).toBe("color(prophoto-rgb 0.5 0.5 0.5)");
        });

        it("serializes rec2020", () => {
            const color = new ColorValue("rec2020", [0.7, 0.8, 0.9]);
            expect(serializer.serialize(color)).toBe("color(rec2020 0.7 0.8 0.9)");
        });

        it("serializes xyz-d65", () => {
            const color = new ColorValue("xyz-d65", [0.2, 0.1, 0.05]);
            expect(serializer.serialize(color)).toBe("color(xyz-d65 0.2 0.1 0.05)");
        });

        it("serializes xyz-d50", () => {
            const color = new ColorValue("xyz-d50", [0.3, 0.2, 0.1]);
            expect(serializer.serialize(color)).toBe("color(xyz-d50 0.3 0.2 0.1)");
        });

        it("appends alpha when not 1", () => {
            const color = new ColorValue("srgb", [1, 0, 0], 0.5);
            expect(serializer.serialize(color)).toBe("color(srgb 1 0 0 / 0.5)");
        });

        it("omits alpha suffix when alpha is 1", () => {
            const color = new ColorValue("srgb", [0, 1, 0], 1);
            expect(serializer.serialize(color)).toBe("color(srgb 0 1 0)");
        });

        it("serializes none component", () => {
            const color = new ColorValue("srgb", ["none", 0.5, 1]);
            expect(serializer.serialize(color)).toBe("color(srgb none 0.5 1)");
        });
    });

    describe("hsl", () => {
        it("serializes hsl with degrees and percentages", () => {
            const color = new ColorValue("hsl", [120, 50, 75]);
            expect(serializer.serialize(color)).toBe("hsl(120 50% 75%)");
        });

        it("serializes hsl with alpha", () => {
            const color = new ColorValue("hsl", [240, 100, 50], 0.8);
            expect(serializer.serialize(color)).toBe("hsl(240 100% 50% / 0.8)");
        });

        it("serializes none hue in hsl", () => {
            const color = new ColorValue("hsl", ["none", 50, 75]);
            expect(serializer.serialize(color)).toBe("hsl(none 50% 75%)");
        });
    });

    describe("hwb", () => {
        it("serializes hwb with percentages", () => {
            const color = new ColorValue("hwb", [30, 10, 20]);
            expect(serializer.serialize(color)).toBe("hwb(30 10% 20%)");
        });

        it("serializes hwb with alpha", () => {
            const color = new ColorValue("hwb", [60, 0, 0], 0.5);
            expect(serializer.serialize(color)).toBe("hwb(60 0% 0% / 0.5)");
        });
    });

    describe("lab", () => {
        it("serializes lab with percentage lightness", () => {
            const color = new ColorValue("lab", [50, 20, -30]);
            expect(serializer.serialize(color)).toBe("lab(50% 20 -30)");
        });

        it("serializes lab with alpha", () => {
            const color = new ColorValue("lab", [80, 10, 5], 0.9);
            expect(serializer.serialize(color)).toBe("lab(80% 10 5 / 0.9)");
        });
    });

    describe("lch", () => {
        it("serializes lch with percentage lightness", () => {
            const color = new ColorValue("lch", [60, 40, 180]);
            expect(serializer.serialize(color)).toBe("lch(60% 40 180)");
        });

        it("serializes lch with alpha", () => {
            const color = new ColorValue("lch", [40, 25, 90], 0.7);
            expect(serializer.serialize(color)).toBe("lch(40% 25 90 / 0.7)");
        });
    });

    describe("oklab", () => {
        it("serializes oklab without percentage lightness", () => {
            const color = new ColorValue("oklab", [0.5, 0.1, -0.1]);
            expect(serializer.serialize(color)).toBe("oklab(0.5 0.1 -0.1)");
        });

        it("serializes oklab with alpha", () => {
            const color = new ColorValue("oklab", [0.8, 0.05, 0.02], 0.6);
            expect(serializer.serialize(color)).toBe("oklab(0.8 0.05 0.02 / 0.6)");
        });
    });

    describe("oklch", () => {
        it("serializes oklch without percentage lightness", () => {
            const color = new ColorValue("oklch", [0.7, 0.15, 200]);
            expect(serializer.serialize(color)).toBe("oklch(0.7 0.15 200)");
        });

        it("serializes oklch with alpha", () => {
            const color = new ColorValue("oklch", [0.5, 0.2, 300], 0.4);
            expect(serializer.serialize(color)).toBe("oklch(0.5 0.2 300 / 0.4)");
        });

        it("serializes none chroma in oklch", () => {
            const color = new ColorValue("oklch", [0.6, "none", 120]);
            expect(serializer.serialize(color)).toBe("oklch(0.6 none 120)");
        });
    });

    describe("tailwind mode", () => {
        it("computes hex for opaque srgb without hex fallback", () => {
            const color = new ColorValue("srgb", [0.118, 0.161, 0.231], 1);
            expect(tailwindSerializer.serialize(color)).toBe("#1e293b");
        });

        it("serializes translucent srgb as rgb()", () => {
            const color = new ColorValue("srgb", [0, 0, 0], 0.4, "#000000");
            expect(tailwindSerializer.serialize(color)).toBe("rgb(0 0 0 / 0.4)");
        });

        it("keeps non-srgb spaces in native css syntax", () => {
            const color = new ColorValue("oklch", [0.5, 0.2, 300], 0.4);
            expect(tailwindSerializer.serialize(color)).toBe("oklch(0.5 0.2 300 / 0.4)");
        });
    });
});
