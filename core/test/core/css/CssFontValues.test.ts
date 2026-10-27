import { describe, it, expect } from "vitest";
import { TokenReference } from "#/core/model/TokenReference";
import { FontWeightName } from "#/core/model/values/FontWeightName";
import { fontFamilyToCss, fontWeightToCss } from "#/core/platforms/css/CssFontValues";

const GENERIC_FAMILIES: string[] = [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "math",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
];

function cssVar(reference: TokenReference): string {
    return `var(--${reference.value.replace(/\./g, "-")})`;
}

describe("fontWeightToCss", () => {
    it("writes a number as is", () => {
        expect(fontWeightToCss(450)).toBe("450");
    });

    it.each(["normal", "bold"])("keeps the CSS keyword '%s'", (name) => {
        expect(fontWeightToCss(FontWeightName.fromName(name))).toBe(name);
    });

    it.each(
        FontWeightName.names()
            .filter((name) => name !== "normal" && name !== "bold")
            .map((name) => FontWeightName.fromName(name)),
    )("writes '$name' as its number", (fontWeight) => {
        expect(fontWeightToCss(fontWeight)).toBe(String(fontWeight.weight));
    });
});

describe("fontFamilyToCss", () => {
    it.each(GENERIC_FAMILIES)("writes the generic family '%s' without quotes", (family) => {
        expect(fontFamilyToCss([family], cssVar)).toBe(family);
    });

    it("quotes a family name", () => {
        expect(fontFamilyToCss(["Inter"], cssVar)).toBe('"Inter"');
    });

    it("quotes a family name that only resembles a generic family", () => {
        expect(fontFamilyToCss(["Sans-Serif", "serif-display"], cssVar)).toBe('"Sans-Serif", "serif-display"');
    });

    it("quotes a single-string family", () => {
        expect(fontFamilyToCss("Inter", cssVar)).toBe('"Inter"');
    });

    it("writes a single-string generic family without quotes", () => {
        expect(fontFamilyToCss("monospace", cssVar)).toBe("monospace");
    });

    it("joins a list with references formatted by the caller", () => {
        const family = ["Inter", new TokenReference("brand.fonts"), "sans-serif"];

        expect(fontFamilyToCss(family, cssVar)).toBe('"Inter", var(--brand-fonts), sans-serif');
    });
});
