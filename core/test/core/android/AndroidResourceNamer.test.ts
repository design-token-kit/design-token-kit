import { describe, it, expect } from "vitest";
import { AndroidResourceNamer } from "#/core/platforms/android/AndroidResourceNamer";

const namer = new AndroidResourceNamer();

describe("AndroidResourceNamer", () => {
    it("joins path segments with underscores", () => {
        expect(namer.name(["color", "base", "red"])).toBe("color_base_red");
    });

    it("lowercases and splits camelCase segments", () => {
        expect(namer.name(["fontSize", "md"])).toBe("font_size_md");
    });

    it("normalizes separators to underscores", () => {
        expect(namer.name(["brand-primary", "on.surface"])).toBe("brand_primary_on_surface");
    });

    it("drops characters Android resource names forbid", () => {
        expect(namer.name(["space", "50%"])).toBe("space_50");
    });

    it("prefixes names not starting with a letter", () => {
        expect(namer.name(["2xl"])).toBe("token_2xl");
    });

    it("escapes Java keywords, because each resource becomes an R field", () => {
        expect(namer.name(["default"])).toBe("default_");
    });

    it("splits a segment into normalized parts", () => {
        expect(namer.parts("fontSize")).toEqual(["font", "size"]);
        expect(namer.parts("brand-500")).toEqual(["brand", "500"]);
    });
});
