import { describe, it, expect } from "vitest";
import { ColorValue } from "#/core/model/values/ColorValue";
import { ColorSwiftUiSerializer } from "#/core/platforms/swiftui/ColorSwiftUiSerializer";

const serializer = new ColorSwiftUiSerializer();

describe("ColorSwiftUiSerializer", () => {
    it("serializes opaque srgb color", () => {
        const color = new ColorValue("srgb", [1, 0.2, 0.2], 1);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.sRGB, red: 1, green: 0.2, blue: 0.2)");
    });

    it("appends opacity when alpha below 1", () => {
        const color = new ColorValue("srgb", [0, 0, 0], 0.5);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.sRGB, red: 0, green: 0, blue: 0, opacity: 0.5)");
    });

    it("maps display-p3 to the displayP3 space", () => {
        const color = new ColorValue("display-p3", [1, 0, 0], 1);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.displayP3, red: 1, green: 0, blue: 0)");
    });

    it("maps srgb-linear to the linearSRGB space", () => {
        const color = new ColorValue("srgb-linear", [0.5, 0.5, 0.5], 1);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.linearSRGB, red: 0.5, green: 0.5, blue: 0.5)");
    });

    it("falls back to sRGB for unsupported color spaces", () => {
        const color = new ColorValue("oklch", [0.6, 0.1, 200], 1);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.sRGB, red: 0.6, green: 0.1, blue: 200)");
    });

    it("treats none components as zero", () => {
        const color = new ColorValue("srgb", ["none", 0.5, 0.5], 1);
        expect(serializer.serialize(color)).toBe("SwiftUI.Color(.sRGB, red: 0, green: 0.5, blue: 0.5)");
    });
});
