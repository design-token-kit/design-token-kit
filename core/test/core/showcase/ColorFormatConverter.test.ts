import { describe, expect, it } from "vitest";
import { ColorFormatConverter } from "#/core/showcase/ColorFormatConverter";

describe("ColorFormatConverter", () => {
    const converter = new ColorFormatConverter();

    it("returns CSS, HEX, RGBA, and HSLA values for an opaque hex color", () => {
        expect(converter.convert("#336699")).toEqual([
            { name: "css", label: "CSS", value: "#336699" },
            { name: "hex", label: "HEX", value: "#336699" },
            { name: "rgb", label: "RGBA", value: "rgba(51, 102, 153, 1)" },
            { name: "hsl", label: "HSLA", value: "hsla(210, 50%, 40%, 1)" },
        ]);
    });

    it("preserves alpha in all converted values", () => {
        expect(converter.convert("#33669980").map((format) => format.value)).toEqual([
            "#33669980",
            "#33669980",
            "rgba(51, 102, 153, 0.502)",
            "hsla(210, 50%, 40%, 0.502)",
        ]);
    });

    it("converts modern RGB and HSL syntax", () => {
        expect(converter.convert("rgb(100% 0% 50% / 25%)").map((format) => format.value)).toEqual([
            "rgb(100% 0% 50% / 25%)",
            "#ff008040",
            "rgba(255, 0, 128, 0.25)",
            "hsla(330, 100%, 50%, 0.25)",
        ]);
        expect(converter.convert("hsl(0.5turn 100% 50%)")[2]?.value).toBe("rgba(0, 255, 255, 1)");
    });

    it("converts the sRGB CSS color function", () => {
        expect(converter.convert("color(srgb 1 0.5 0 / 0.4)").map((format) => format.value)).toEqual([
            "color(srgb 1 0.5 0 / 0.4)",
            "#ff800066",
            "rgba(255, 128, 0, 0.4)",
            "hsla(30, 100%, 50%, 0.4)",
        ]);
    });

    it("returns the source value when the color space cannot be converted", () => {
        expect(converter.convert("color(display-p3 1 0 0)")).toEqual([
            { name: "css", label: "CSS", value: "color(display-p3 1 0 0)" },
        ]);
    });

    it("supports transparent", () => {
        expect(converter.convert("transparent").map((format) => format.value)).toEqual([
            "transparent",
            "#00000000",
            "rgba(0, 0, 0, 0)",
            "hsla(0, 0%, 0%, 0)",
        ]);
    });
});
