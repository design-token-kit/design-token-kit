import { describe, it, expect } from "vitest";
import { TokenFile, TokenFiles } from "#/core/io/TokenFile";

describe("TokenFile", () => {
    it.each([
        ["tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["tokens.high-contrast.json", false, "high-contrast", ':root[data-theme="high-contrast"]'],
        ["some/deep/path/tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["some\\deep\\path\\tokens.dark.json", false, "dark", ':root[data-theme="dark"]'],
        ["base.json", true, "base", ":root"],
        ["tokens.json", true, "tokens", ":root"],
        ["valid.json", false, "valid", ':root[data-theme="valid"]'],
    ])("parses %s", (name, isBase, theme, selector) => {
        const file = new TokenFile(name, isBase);
        expect(file.themeName).toBe(theme);
        expect(file.isBase).toBe(isBase);
        expect(file.selector).toBe(selector);
    });
});

describe("TokenFiles", () => {
    it("creates files preserving input order", () => {
        const catalog = TokenFiles.fromNames(["tokens.json", "tokens.dark.json"]);
        expect(catalog.files).toHaveLength(2);
        expect(catalog.files[0].name).toBe("tokens");
        expect(catalog.files[0].isBase).toBe(true);
        expect(catalog.files[1].name).toBe("dark");
        expect(catalog.files[1].isBase).toBe(false);
        expect(catalog.baseToken.themeName).toBe("tokens");
    });

    it("creates single base file", () => {
        const catalog = TokenFiles.fromNames(["tokens.json"]);
        expect(catalog.files).toHaveLength(1);
        expect(catalog.files[0].isBase).toBe(true);
    });

    it("finds file by theme name", () => {
        const catalog = TokenFiles.fromNames(["tokens.json", "tokens.dark.json"]);
        expect(catalog.getToken("dark").themeName).toBe("dark");
    });

    it("accepts any file names", () => {
        const catalog = TokenFiles.fromNames(["base.json", "valid.json"]);
        expect(catalog.files[0].name).toBe("base");
        expect(catalog.files[0].isBase).toBe(true);
        expect(catalog.files[1].name).toBe("valid");
    });

    it("throws on empty names", () => {
        expect(() => TokenFiles.fromNames([])).toThrow("No token sources provided");
    });

    it("throws for unknown theme", () => {
        expect(() => TokenFiles.fromNames(["tokens.json"]).getToken("dark")).toThrow("Unknown token theme");
    });
});
