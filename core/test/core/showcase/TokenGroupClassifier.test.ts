import { describe, it, expect } from "vitest";
import { TokenGroupClassifier } from "#/core/showcase/TokenGroupClassifier";
import type { ScopedTokenEntry, ThemeBucket, TokenEntry } from "#/core/showcase/CssTokenParser";

function entry(name: string, value: string, scope = "primitive", themeName?: string): ScopedTokenEntry {
    return { name, value, scope, themeName };
}

function token(name: string, value: string): TokenEntry {
    return { name, value };
}

describe("TokenGroupClassifier", () => {
    const classifier = new TokenGroupClassifier();

    describe("groupEntriesByScope", () => {
        it("groups entries by scope", () => {
            const entries = [
                entry("--primitive-color-brand", "#fff", "primitive"),
                entry("--semantic-color-text", "var(--x)", "semantic"),
                entry("--component-bg", "#000", "primitive"),
            ];
            const result = classifier.groupEntriesByScope(entries);
            expect(result.get("primitive")!.map((e) => e.name)).toEqual([
                "--primitive-color-brand",
                "--component-bg",
            ]);
            expect(result.get("semantic")!.map((e) => e.name)).toEqual(["--semantic-color-text"]);
        });

        it("strips scope field - result entries have only name and value", () => {
            const result = classifier.groupEntriesByScope([entry("--a", "1px", "primitive")]);
            const item = result.get("primitive")![0];
            expect(item).toEqual({ name: "--a", value: "1px" });
            expect((item as Record<string, unknown>)["scope"]).toBeUndefined();
        });

        it("returns empty map for empty input", () => {
            expect(classifier.groupEntriesByScope([])).toEqual(new Map());
        });
    });

    describe("getPrimitiveThemes", () => {
        it("keeps only primitive-scoped entries from each theme", () => {
            const themes: ThemeBucket[] = [
                {
                    name: "base",
                    entries: [
                        entry("--primitive-color-brand", "#fff", "primitive"),
                        entry("--semantic-color-text", "var(--x)", "semantic"),
                    ],
                },
            ];
            const result = classifier.getPrimitiveThemes(themes);
            expect(result[0].entries).toHaveLength(1);
            expect(result[0].entries[0].name).toBe("--primitive-color-brand");
        });

        it("omits themes that have no primitive entries", () => {
            const themes: ThemeBucket[] = [
                {
                    name: "dark",
                    entries: [entry("--semantic-color-text", "var(--x)", "semantic")],
                },
            ];
            expect(classifier.getPrimitiveThemes(themes)).toHaveLength(0);
        });

        it("preserves theme name", () => {
            const themes: ThemeBucket[] = [
                {
                    name: "base.dark",
                    entries: [entry("--primitive-color-brand", "#000", "primitive")],
                },
            ];
            expect(classifier.getPrimitiveThemes(themes)[0].name).toBe("base.dark");
        });
    });

    describe("getOrderedScopes", () => {
        it("orders primitive before semantic before component", () => {
            const scopes = new Map([
                ["component", [token("--c", "1")]],
                ["semantic", [token("--s", "2")]],
                ["primitive", [token("--p", "3")]],
            ]);
            const ordered = classifier.getOrderedScopes(scopes).map(([name]) => name);
            expect(ordered).toEqual(["primitive", "semantic", "component"]);
        });

        it("places unknown scopes after known ones, sorted alphabetically", () => {
            const scopes = new Map([
                ["zebra", [token("--z", "1")]],
                ["alpha", [token("--a", "2")]],
                ["primitive", [token("--p", "3")]],
            ]);
            const ordered = classifier.getOrderedScopes(scopes).map(([name]) => name);
            expect(ordered).toEqual(["primitive", "alpha", "zebra"]);
        });
    });

    describe("groupTokens", () => {
        it("classifies hex color value into colors", () => {
            const result = classifier.groupTokens([token("--primitive-brand", "#ff0000")]);
            expect(result.get("colors")).toBeDefined();
            expect(result.get("colors")![0].name).toBe("--primitive-brand");
        });

        it("classifies token with 'color' in name into colors", () => {
            const result = classifier.groupTokens([token("--semantic-color-brand-primary", "var(--x)")]);
            expect(result.has("colors")).toBe(true);
        });

        it("classifies rgb value into colors", () => {
            const result = classifier.groupTokens([token("--brand", "rgb(0,0,0)")]);
            expect(result.has("colors")).toBe(true);
        });

        it("classifies font-family into fonts", () => {
            const result = classifier.groupTokens([token("--primitive-font-family-0", "Inter")]);
            expect(result.has("fonts")).toBe(true);
        });

        it("classifies font-size into fonts", () => {
            const result = classifier.groupTokens([token("--primitive-font-size-md", "16px")]);
            expect(result.has("fonts")).toBe(true);
        });

        it("classifies typography token name into typography group", () => {
            const result = classifier.groupTokens([token("--semantic-typography-body-md", "500 16px/1.5 Inter")]);
            expect(result.has("typography")).toBe(true);
        });

        it("classifies -text- in name into typography", () => {
            const result = classifier.groupTokens([token("--semantic-text-caption", "var(--x)")]);
            expect(result.has("typography")).toBe(true);
        });

        it("classifies border into borders", () => {
            const result = classifier.groupTokens([token("--primitive-border-focus-ring", "2px solid #000")]);
            expect(result.has("borders")).toBe(true);
        });

        it("classifies shadow into shadows", () => {
            const result = classifier.groupTokens([token("--semantic-shadow-md", "0 4px 8px rgba(0,0,0,.2)")]);
            expect(result.has("shadows")).toBe(true);
        });

        it("classifies gradient into gradients", () => {
            const result = classifier.groupTokens([token("--primitive-gradient-brand", "linear-gradient(...)")]);
            expect(result.has("gradients")).toBe(true);
        });

        it("classifies radius into radius group", () => {
            const result = classifier.groupTokens([token("--primitive-dimension-radius-md", "8px")]);
            expect(result.has("radius")).toBe(true);
        });

        it("classifies spacing token into spacing", () => {
            const result = classifier.groupTokens([token("--semantic-space-inset-sm", "8px")]);
            expect(result.has("spacing")).toBe(true);
        });

        it("classifies transition into motion", () => {
            const result = classifier.groupTokens([token("--semantic-motion-transition-fast", "150ms ease")]);
            expect(result.has("motion")).toBe(true);
        });

        it("classifies ms-value token into motion", () => {
            const result = classifier.groupTokens([token("--duration-fast", "200ms")]);
            expect(result.has("motion")).toBe(true);
        });

        it("classifies opacity into opacity", () => {
            const result = classifier.groupTokens([token("--semantic-opacity-disabled", "0.38")]);
            expect(result.has("opacity")).toBe(true);
        });

        it("classifies width into sizes", () => {
            const result = classifier.groupTokens([token("--component-icon-width", "24px")]);
            expect(result.has("sizes")).toBe(true);
        });

        it("puts unrecognized tokens into other", () => {
            const result = classifier.groupTokens([token("--misc-token", "some-value")]);
            expect(result.has("other")).toBe(true);
        });

        it("omits empty groups from result", () => {
            const result = classifier.groupTokens([token("--primitive-color-brand", "#fff")]);
            expect(result.has("shadows")).toBe(false);
            expect(result.has("gradients")).toBe(false);
        });

        it("typography takes priority over font properties when name contains 'typography'", () => {
            const result = classifier.groupTokens([
                token("--primitive-typography-body-fontSize", "16px"),
            ]);
            expect(result.has("typography")).toBe(true);
            expect(result.has("fonts")).toBe(false);
        });
    });
});
