import { describe, it, expect } from "vitest";
import { DesignToken, DesignTokens } from "#/core/DesignToken";

describe("DesignToken", () => {
    it.each([
        ["tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["tokens.high-contrast.json", false, "high-contrast", ':root[data-theme="high-contrast"]'],
        ["some/deep/path/tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["some\\deep\\path\\tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["base.json", true, "base", ":root"],
        ["tokens.json", true, "tokens", ":root"],
        ["valid.json", false, "valid", ':root[data-theme="valid"]'],
    ])("parses %s", (name, isBase, theme, selector) => {
        const token = new DesignToken(name, isBase);
        expect(token.themeName).toBe(theme);
        expect(token.isBase).toBe(isBase);
        expect(token.selector).toBe(selector);
    });
});

describe("DesignTokens", () => {
    it("creates tokens preserving input order", () => {
        const catalog = DesignTokens.fromNames(["tokens.json", "tokens.dark.json"]);
        expect(catalog.tokens).toHaveLength(2);
        expect(catalog.tokens[0].name).toBe("tokens");
        expect(catalog.tokens[0].isBase).toBe(true);
        expect(catalog.tokens[1].name).toBe("dark");
        expect(catalog.tokens[1].isBase).toBe(false);
        expect(catalog.baseToken.themeName).toBe("tokens");
    });

    it("creates single base token", () => {
        const catalog = DesignTokens.fromNames(["tokens.json"]);
        expect(catalog.tokens).toHaveLength(1);
        expect(catalog.tokens[0].isBase).toBe(true);
    });

    it("finds token by theme name", () => {
        const catalog = DesignTokens.fromNames(["tokens.json", "tokens.dark.json"]);
        expect(catalog.getToken("dark").themeName).toBe("dark");
    });

    it("accepts any file names", () => {
        const catalog = DesignTokens.fromNames(["base.json", "valid.json"]);
        expect(catalog.tokens[0].name).toBe("base");
        expect(catalog.tokens[0].isBase).toBe(true);
        expect(catalog.tokens[1].name).toBe("valid");
    });

    it("throws on empty names", () => {
        expect(() => DesignTokens.fromNames([])).toThrow("No token sources provided");
    });

    it("throws for unknown theme", () => {
        expect(() => DesignTokens.fromNames(["tokens.json"]).getToken("dark")).toThrow("Unknown token theme");
    });
});
