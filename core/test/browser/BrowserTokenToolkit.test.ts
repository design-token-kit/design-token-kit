import { describe, expect, it } from "vitest";
import { CheckScope } from "#/core/check/CheckScope";
import { Format } from "#/core/io/Format";
import { BrowserTokenToolkit } from "#/browser/BrowserTokenToolkit";
import {
    BrowserTokenValidationError,
    type BrowserTokenSet,
} from "#/browser/BrowserTokenToolkit";

const validDtcg = JSON.stringify({
    primitive: {
        color: {
            "$type": "color",
            brand: {
                "$description": "Brand color.",
                "$value": { colorSpace: "srgb", components: [0.15, 0.29, 0.96] },
            },
        },
    },
    semantic: {
        color: {
            action: {
                "$type": "color",
                "$description": "Primary action color.",
                "$value": "{primitive.color.brand}",
            },
        },
    },
});

describe("BrowserTokenToolkit", () => {
    it("runs schema, semantic, and lint checks against browser content", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({
            base: {
                source: "tokens.json",
                content: JSON.stringify({
                    primitive: {
                        color: {
                            "$type": "color",
                            brand: { "$value": { colorSpace: "srgb", components: [0, 0, 1] } },
                        },
                    },
                    semantic: {
                        color: {
                            broken: { "$type": "color", "$value": "{primitive.color.missing}" },
                        },
                    },
                }),
                format: Format.DTCG,
            },
        }, { scope: CheckScope.LINT });

        expect(issues.map((issue) => issue.id)).toContain("bad-reference");
        expect(issues.map((issue) => issue.id)).not.toContain("missing-description");
    });

    it("validates HRDT and DESIGN.md with bundled schemas", () => {
        const toolkit = new BrowserTokenToolkit();

        expect(toolkit.check({
            base: {
                source: "tokens.yaml",
                format: Format.HRDT,
                content: "primitive:\n  color:\n    brand: \"#2549f6\"\n",
            },
        }, { scope: CheckScope.SCHEMA })).toEqual([]);

        expect(toolkit.check({
            base: {
                source: "DESIGN.md",
                format: Format.DESIGN_MD,
                content: "---\ncolors:\n  brand: \"#2549f6\"\n---\n\n## Colors\n",
            },
        }, { scope: CheckScope.SCHEMA })).toEqual([]);
    });

    it("uses the selected built-in DTCG schema", () => {
        const toolkit = new BrowserTokenToolkit();
        const emDimension = JSON.stringify({
            primitive: {
                size: {
                    "$type": "dimension",
                    body: { "$value": { value: 1, unit: "em" } },
                },
            },
        });
        const input: BrowserTokenSet = {
            base: { source: "tokens.json", format: Format.DTCG, content: emDimension },
        };

        expect(toolkit.check(input, { scope: CheckScope.SCHEMA }).length).toBeGreaterThan(0);
        expect(toolkit.check(input, {
            scope: CheckScope.SCHEMA,
            schema: "2025.10-design.md",
        })).toEqual([]);
        expect(() => toolkit.convert(input, Format.CSS, {
            schema: "2025.10-design.md",
        })).not.toThrow();
    });

    it("converts a base document and a named theme without file access", () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = toolkit.convert({
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: Format.DTCG,
                    content: JSON.stringify({
                        semantic: {
                            color: {
                                action: {
                                    "$type": "color",
                                    "$description": "Primary action color.",
                                    "$value": { colorSpace: "srgb", components: [0, 0, 0] },
                                },
                            },
                        },
                    }),
                },
            },
        }, Format.CSS);

        expect(outputs).toEqual([
            expect.objectContaining({ fileName: "tokens.css" }),
        ]);
        expect(outputs[0]?.content).toContain('data-theme="dark"');
    });

    it("creates self-contained showcase output and token statistics", () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
        };

        expect(toolkit.convert(input, "showcase")[0]?.content).toContain("Design Tokens - showcase");
        expect(toolkit.stats(input)[0]).toMatchObject({ label: "Total tokens", value: 2 });
    });

    it("includes base tokens in a themed showcase", () => {
        const toolkit = new BrowserTokenToolkit();
        const output = toolkit.convert({
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: Format.DTCG,
                    content: JSON.stringify({
                        semantic: {
                            color: {
                                action: { "$type": "color", "$value": "{primitive.color.brand}" },
                            },
                        },
                    }),
                },
            },
        }, "showcase")[0]?.content;

        expect(output).toContain("Theme: base");
        expect(output).toContain("Theme: dark");
        expect(output).toContain("--primitive-color-brand");
    });

    it("rejects semantic errors before conversion and statistics", () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                source: "tokens.json",
                format: Format.DTCG,
                content: JSON.stringify({
                    semantic: {
                        broken: { "$type": "color", "$value": "{primitive.color.missing}" },
                    },
                }),
            },
        };

        expect(() => toolkit.convert(input, Format.CSS)).toThrow(BrowserTokenValidationError);
        expect(() => toolkit.stats(input)).toThrow(BrowserTokenValidationError);
    });

    it("loads additional HRDT documents as generated themes", () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = toolkit.convert({
            base: {
                source: "tokens.yaml",
                format: Format.HRDT,
                content: [
                    "primitive:\n  number:\n    opacity: 1",
                    "---",
                    "primitive:\n  number:\n    opacity: 0.5",
                ].join("\n"),
            },
        }, Format.CSS);

        expect(outputs[0]?.content).toContain('data-theme="theme-1"');
    });

    it("reports HRDT YAML syntax errors instead of partial schema errors", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({
            base: {
                source: "tokens.yaml",
                format: Format.HRDT,
                content: "primitive:\n  number:\n    opacity: [1, 2\n  bad: : :\n",
            },
        });

        expect(issues).toEqual([
            expect.objectContaining({ id: "schema", sourcePath: "tokens.yaml" }),
        ]);
        expect(issues[0]?.message).not.toMatch(/^\//);
    });

    it("rejects a theme name that collides with a generated theme", () => {
        const toolkit = new BrowserTokenToolkit();
        const hrdt = "primitive:\n  number:\n    opacity: 1";
        const input: BrowserTokenSet = {
            base: { source: "tokens.yaml", format: Format.HRDT, content: `${hrdt}\n---\n${hrdt}` },
            themes: {
                "theme-1": { source: "tokens.theme-1.yaml", format: Format.HRDT, content: hrdt },
            },
        };

        expect(toolkit.check(input)).toEqual([
            expect.objectContaining({ id: "theme-name", sourcePath: "tokens.theme-1.yaml" }),
        ]);
        expect(() => toolkit.convert(input, Format.DTCG)).toThrow(BrowserTokenValidationError);
    });

    it("warns about ignored DESIGN.md values without blocking conversion", () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                source: "DESIGN.md",
                format: Format.DESIGN_MD,
                content: `---
name: Test
colors:
  primary: "#1A1C1E"
components:
  button:
    backgroundColor: "{colors.primary}"
    borderColor: "#ff0000"
---

## Overview
`,
            },
        };

        expect(toolkit.check(input)).toEqual([
            expect.objectContaining({ id: "design-md-ignored-value", severity: "warning", sourcePath: "DESIGN.md" }),
        ]);
        expect(toolkit.convert(input, Format.CSS)[0]?.content).toContain("--colors-primary");
    });

    it("rejects a theme without documents", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({
            base: { source: "tokens.yaml", format: Format.HRDT, content: "primitive:\n  number:\n    opacity: 1" },
            themes: { dark: { source: "tokens.dark.yaml", format: Format.HRDT, content: "" } },
        });

        expect(issues).toEqual([
            expect.objectContaining({ id: "theme-name", sourcePath: "tokens.dark.yaml" }),
        ]);
    });

    it("attributes parser errors to the failing theme source", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "DESIGN.dark.md",
                    format: Format.DESIGN_MD,
                    content: "---\ncolors:\n  bad: not-a-color\n---\n\n## Colors\n",
                },
            },
        });

        expect(issues).toEqual([
            expect.objectContaining({ sourcePath: "DESIGN.dark.md" }),
        ]);
    });

    it("maps DESIGN.md theme references against base tokens", () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = toolkit.convert({
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: Format.DTCG,
                    content: JSON.stringify({
                        semantic: {
                            color: {
                                action: { "$type": "color", "$value": "{primitive.color.brand}" },
                            },
                        },
                    }),
                },
            },
        }, Format.DESIGN_MD);

        expect(outputs.find((output) => output.themeName === "dark")?.content)
            .toContain("{colors.brand}");
    });

    it("rejects unsafe theme names before generating CSS", () => {
        const toolkit = new BrowserTokenToolkit();
        const unsafe: BrowserTokenSet = {
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
            themes: {
                'dark\"] body { color: red }': {
                    source: "tokens.dark.json",
                    format: Format.DTCG,
                    content: "{}",
                },
            },
        };

        expect(toolkit.check(unsafe)).toEqual([
            expect.objectContaining({ id: "theme-name" }),
        ]);
        expect(() => toolkit.convert(unsafe, Format.CSS)).toThrow(BrowserTokenValidationError);
    });

    it("uses filename hints for malformed input", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({ base: { source: "broken.json", content: "{" } });

        expect(issues[0]?.sourcePath).toBe("broken.json");
        expect(issues[0]?.message).toMatch(/JSON|position|property name/i);
    });

    it("rejects DESIGN.md values that the reader cannot preserve", () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = toolkit.check({
            base: {
                source: "DESIGN.md",
                format: Format.DESIGN_MD,
                content: "---\ncolors:\n  bad: 123\n---\n\n## Colors\n",
            },
        }, { scope: CheckScope.SCHEMA });

        expect(issues.length).toBeGreaterThan(0);
        expect(issues.every((issue) => issue.id === "schema")).toBe(true);
    });

    it("returns separate files for multi-file output formats", () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { source: "tokens.json", format: Format.DTCG, content: validDtcg },
        };

        expect(toolkit.convert(input, Format.SCSS)).toEqual([
            expect.objectContaining({ fileName: "tokens.base.scss" }),
        ]);
        expect(toolkit.convert(input, Format.ANDROID)).toEqual(expect.arrayContaining([
            expect.objectContaining({ fileName: expect.stringMatching(/^values\//) }),
        ]));
    });

    it("rejects conversion when schema validation fails", () => {
        const toolkit = new BrowserTokenToolkit();
        const invalid: BrowserTokenSet = {
            base: {
                source: "invalid.json",
                format: Format.DTCG,
                content: "{",
            },
        };

        expect(() => toolkit.convert(invalid, Format.CSS)).toThrow(BrowserTokenValidationError);
    });
});
