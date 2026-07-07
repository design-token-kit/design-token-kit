import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CssTokenParser } from "#/core/showcase/CssTokenParser";

const fixturesDir = fileURLToPath(new URL("fixtures", import.meta.url));
const tailwindCss = `@import 'tailwindcss';

@theme {
  --color-primitive-white: #ffffff;
  --spacing-md: 16px;
}

:root {
  --color-primitive-white: #ffffff;
  --spacing-md: 16px;
}

[data-theme='dark'] {
  --color-primitive-white: #111111;
}

:host([data-theme='contrast']) {
  --color-primitive-white: #000000;
}
`;

function fixture(name: string): string {
    return readFileSync(`${fixturesDir}/${name}`, "utf-8");
}

describe("CssTokenParser", () => {
    const parser = new CssTokenParser();

    describe("simple :root block without Set/Modifier", () => {
        it("extracts token names with double-dash prefix", () => {
            const result = parser.parse(fixture("tokens.css"));
            const names = result.entries.map((e) => e.name);
            expect(names).toContain("--showcase-color-brand");
            expect(names).toContain("--showcase-spacing-md");
        });

        it("extracts token values", () => {
            const result = parser.parse(fixture("tokens.css"));
            const brand = result.entries.find((e) => e.name === "--showcase-color-brand");
            expect(brand?.value).toBe("#20b2aa");
        });

        it("derives scope from first segment of token name", () => {
            const result = parser.parse(fixture("tokens.css"));
            const brand = result.entries.find((e) => e.name === "--showcase-color-brand");
            expect(brand?.scope).toBe("showcase");
        });

        it("produces no themes when there is no Set comment", () => {
            const result = parser.parse(fixture("tokens.css"));
            expect(result.themes).toHaveLength(0);
        });

        it("themeName is undefined for tokens outside Set/Modifier blocks", () => {
            const result = parser.parse(fixture("tokens.css"));
            expect(result.entries.every((e) => e.themeName === undefined)).toBe(true);
        });
    });

    describe("Set and Modifier blocks", () => {
        it("assigns Set name as themeName to root-block tokens", () => {
            const result = parser.parse(fixture("themes.css"));
            const entry = result.entries.find((e) => e.name === "--primitive-color-brand-500" && e.themeName === "base");
            expect(entry).toBeDefined();
        });

        it("assigns compound theme name (Set.theme) for Modifier blocks", () => {
            const result = parser.parse(fixture("themes.css"));
            const dark = result.entries.find(
                (e) => e.name === "--primitive-color-brand-500" && e.themeName === "base.dark"
            );
            expect(dark).toBeDefined();
        });

        it("groups entries by theme name in themes array", () => {
            const result = parser.parse(fixture("themes.css"));
            const themeNames = result.themes.map((t) => t.name);
            expect(themeNames).toContain("base");
            expect(themeNames).toContain("base.dark");
            expect(themeNames).toContain("base.red");
        });

        it("includes all tokens from a Set block in its theme bucket", () => {
            const result = parser.parse(fixture("themes.css"));
            const base = result.themes.find((t) => t.name === "base");
            const names = base!.entries.map((e) => e.name);
            expect(names).toContain("--primitive-color-brand-500");
            expect(names).toContain("--semantic-color-text-primary");
        });

        it("includes tokens from Modifier in respective theme bucket", () => {
            const result = parser.parse(fixture("themes.css"));
            const dark = result.themes.find((t) => t.name === "base.dark");
            expect(dark!.entries.map((e) => e.name)).toContain("--primitive-color-brand-500");
        });
    });

    describe("multi-scope tokens (semantic.css)", () => {
        it("parses tokens from multiple scopes in one block", () => {
            const result = parser.parse(fixture("semantic.css"));
            const scopes = new Set(result.entries.map((e) => e.scope));
            expect(scopes).toContain("primitive");
            expect(scopes).toContain("semantic");
            expect(scopes).toContain("component");
        });

        it("extracts var() references as values", () => {
            const result = parser.parse(fixture("semantic.css"));
            const entry = result.entries.find((e) => e.name === "--semantic-color-text-primary");
            expect(entry?.value).toBe("var(--primitive-color-neutral-900)");
        });

        it("normalizes whitespace in multi-word values", () => {
            const result = parser.parse(fixture("semantic.css"));
            const entry = result.entries.find((e) => e.name === "--semantic-motion-transition-fast");
            expect(entry?.value).toBe("150ms ease");
        });
    });

    describe("edge cases", () => {
        it("returns empty entries and themes for empty input", () => {
            const result = parser.parse("");
            expect(result.entries).toHaveLength(0);
            expect(result.themes).toHaveLength(0);
        });

        it("returns empty result when there are no :root blocks", () => {
            const result = parser.parse("/* just a comment */\nbody { color: red; }");
            expect(result.entries).toHaveLength(0);
        });

        it("handles multiple :root blocks in a single file", () => {
            const result = parser.parse(fixture("themes.css"));
            const allNames = result.entries.map((e) => e.name);
            // base block + dark modifier + red modifier each have brand-500
            const occurrences = allNames.filter((n) => n === "--primitive-color-brand-500");
            expect(occurrences.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe("tailwind v4 css", () => {
        it("extracts base tokens from @theme", () => {
            const result = parser.parse(tailwindCss);
            expect(result.entries.some((e) => e.name === "--color-primitive-white" && e.themeName === undefined)).toBe(true);
            expect(result.entries.some((e) => e.name === "--spacing-md" && e.themeName === undefined)).toBe(true);
        });

        it("does not duplicate base tokens from the :root mirror block", () => {
            const result = parser.parse(tailwindCss);
            const baseEntries = result.entries.filter((e) => e.name === "--color-primitive-white" && e.themeName === undefined);
            expect(baseEntries).toHaveLength(1);
        });

        it("extracts theme overrides from data-theme selectors", () => {
            const result = parser.parse(tailwindCss);
            const dark = result.entries.find((e) => e.name === "--color-primitive-white" && e.themeName === "dark");
            expect(dark?.value).toBe("#111111");
        });

        it("extracts theme overrides from host data-theme selectors", () => {
            const result = parser.parse(tailwindCss);
            const contrast = result.entries.find((e) => e.name === "--color-primitive-white" && e.themeName === "contrast");
            expect(contrast?.value).toBe("#000000");
        });

        it("groups tailwind theme overrides in the themes array", () => {
            const result = parser.parse(tailwindCss);
            const themeNames = result.themes.map((t) => t.name);
            expect(themeNames).toContain("dark");
            expect(themeNames).toContain("contrast");
        });
    });
});
