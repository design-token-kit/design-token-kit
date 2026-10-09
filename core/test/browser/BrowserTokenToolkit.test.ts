import { describe, expect, it } from "vitest";
import { CheckScope } from "#/core/check/CheckScope";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { PlatformFormat } from "#/core/platforms/PlatformFormat";
import { BrowserTokenToolkit } from "#/browser/BrowserTokenToolkit";
import {
    BrowserTokenValidationError,
    type BrowserInputFormat,
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
    it("reserves the base theme name before producing ambiguous output", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { content: validDtcg },
            themes: { base: { content: "{}" } },
        };

        expect(await toolkit.check(input)).toEqual([
            expect.objectContaining({ id: "theme-name", sourcePath: "base", severity: "error" }),
        ]);
        expect(() => toolkit.convert(input, PlatformFormat.SCSS)).toThrow(BrowserTokenValidationError);
    });

    it.each(["schema", "parser", "semantic"] as const)("attributes %s errors to unnamed sources", async (stage) => {
        const toolkit = new BrowserTokenToolkit();
        const documents = {
            schema: { format: TokenFormat.DTCG, content: "{" },
            parser: { format: TokenFormat.DESIGN_MD, content: "---\ncolors:\n  bad: not-a-color\n---\n" },
            semantic: {
                format: TokenFormat.DTCG,
                content: '{"semantic":{"bad":{"$type":"color","$value":"{primitive.missing}"}}}',
            },
        } as const;
        const issues = await toolkit.check({
            base: { content: validDtcg },
            themes: { dark: documents[stage] },
        });

        expect(issues.length).toBeGreaterThan(0);
        expect(issues.every((issue) => issue.sourcePath === "dark")).toBe(true);
    });

    it("does not let a check allow-list bypass conversion or statistics validation", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                content: '{"semantic":{"bad":{"$type":"color","$value":"{primitive.missing}"}}}',
            },
        };
        const options = { scope: CheckScope.SCHEMA, checks: ["missing-description"] };

        expect(() => toolkit.convert(input, PlatformFormat.CSS, options)).toThrow(BrowserTokenValidationError);
        expect(() => toolkit.stats(input, options)).toThrow(BrowserTokenValidationError);
    });

    it("rejects colliding Android output paths", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { content: validDtcg },
            themes: { dark: { content: validDtcg }, night: { content: validDtcg } },
        };

        expect(() => toolkit.convert(input, PlatformFormat.ANDROID)).toThrow(expect.objectContaining({
            issues: [expect.objectContaining({ id: "output-name", sourcePath: "night" })],
        }));
    });

    it.each(["invalid", "toString", "__proto__"])("rejects runtime output format %s explicitly", async (format) => {
        const toolkit = new BrowserTokenToolkit();

        // JavaScript consumers and UI selections are not protected by TypeScript unions.
        expect(() => toolkit.convert({ base: { source: "tokens.json", content: validDtcg } }, format as PlatformFormat.CSS)).toThrow(expect.objectContaining({
                issues: [expect.objectContaining({ id: "output-format", sourcePath: "tokens.json" })],
            }));
    });

    it.each([...Object.values(TokenFormat), ...Object.values(PlatformFormat)])("produces nonempty %s output through the browser facade", async (format) => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = await toolkit.convert({ base: { content: validDtcg } }, format);

        expect(outputs.length).toBeGreaterThan(0);
        expect(outputs.every((output) => output.content.trim().length > 0)).toBe(true);
        expect(new Set(outputs.map((output) => output.fileName)).size).toBe(outputs.length);
    });

    it("keeps schema warnings when a later document fails to parse", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: {
                source: "DESIGN.md",
                content: '---\ncolors:\n  primary: "#1A1C1E"\ncomponents:\n  button:\n    borderColor: "#ff0000"\n---\n',
            },
            themes: {
                dark: { format: TokenFormat.DESIGN_MD, content: "---\ncolors:\n  bad: not-a-color\n---\n" },
            },
        });

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "design-md-ignored-value", sourcePath: "DESIGN.md" }),
            expect.objectContaining({ severity: "error", sourcePath: "dark" }),
        ]));
    });

    it("does not mutate caller documents when assigning diagnostic sources", async () => {
        const toolkit = new BrowserTokenToolkit();
        const base = Object.freeze({ content: validDtcg });
        const dark = Object.freeze({ content: validDtcg });

        expect(await toolkit.check({ base, themes: { dark } })).toEqual([]);
        expect(base).not.toHaveProperty("source");
        expect(dark).not.toHaveProperty("source");
    });

    it("runs schema, semantic, and lint checks against browser content", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
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
                format: TokenFormat.DTCG,
            },
        }, { scope: CheckScope.LINT });

        expect(issues.map((issue) => issue.id)).toContain("bad-reference");
        expect(issues.map((issue) => issue.id)).not.toContain("missing-description");
    });

    it("runs missing descriptions only when explicitly selected", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                format: TokenFormat.DTCG,
                content: JSON.stringify({
                    primitive: {
                        color: {
                            "$type": "color",
                            brand: { "$value": { colorSpace: "srgb", components: [0, 0, 1] } },
                        },
                    },
                }),
            },
        };

        expect((await toolkit.check(input, { scope: CheckScope.LINT }))
            .map((issue) => issue.id)).not.toContain("missing-description");
        expect((await toolkit.check(input, {
            scope: CheckScope.LINT,
            checks: ["missing-description"],
        })).map((issue) => issue.id)).toContain("missing-description");
        expect((await toolkit.check(input, {
            scope: CheckScope.LINT,
            checks: [],
        })).map((issue) => issue.id)).toContain("missing-description");
    });

    it("uses custom layer order for architecture checks", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                format: TokenFormat.DTCG,
                content: JSON.stringify({
                    primitive: {
                        color: {
                            "$type": "color",
                            brand: { "$value": { colorSpace: "srgb", components: [0, 0, 1] } },
                        },
                    },
                    component: {
                        button: { "$value": "{primitive.color.brand}" },
                    },
                }),
            },
        };

        expect((await toolkit.check(input, { scope: CheckScope.LINT }))
            .map((issue) => issue.id)).toContain("layer-reference");
        expect((await toolkit.check(input, {
            scope: CheckScope.LINT,
            layers: ["primitive", "component"],
        })).map((issue) => issue.id)).not.toContain("layer-reference");
    });

    it("validates HRDT and DESIGN.md with bundled schemas", async () => {
        const toolkit = new BrowserTokenToolkit();

        expect(await toolkit.check({
            base: {
                source: "tokens.yaml",
                format: TokenFormat.HRDT,
                content: "primitive:\n  color:\n    brand: \"#2549f6\"\n",
            },
        }, { scope: CheckScope.SCHEMA })).toEqual([]);

        expect(await toolkit.check({
            base: {
                source: "DESIGN.md",
                format: TokenFormat.DESIGN_MD,
                content: "---\ncolors:\n  brand: \"#2549f6\"\n---\n\n## Colors\n",
            },
        }, { scope: CheckScope.SCHEMA })).toEqual([]);
    });

    it("uses the selected built-in DTCG schema", async () => {
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
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: emDimension },
        };

        expect((await toolkit.check(input, { scope: CheckScope.SCHEMA })).length).toBeGreaterThan(0);
        expect(await toolkit.check(input, {
            scope: CheckScope.SCHEMA,
            schema: "2025.10-design.md",
        })).toEqual([]);
        expect(toolkit.convert(input, PlatformFormat.CSS, {
            schema: "2025.10-design.md",
        })).not.toHaveLength(0);
    });

    it("converts a base document and a named theme without file access", async () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = await toolkit.convert({
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: TokenFormat.DTCG,
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
        }, PlatformFormat.CSS);

        expect(outputs).toEqual([
            expect.objectContaining({ fileName: "tokens.css" }),
        ]);
        expect(outputs[0]?.content).toContain('data-theme="dark"');
    });

    it("creates self-contained showcase output and token statistics", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
        };

        expect((await toolkit.convert(input, "showcase"))[0]?.content).toContain("Design Tokens - showcase");
        expect((await toolkit.stats(input))[0]).toMatchObject({ label: "Total tokens", value: 2 });
    });

    it("includes base tokens in a themed showcase", async () => {
        const toolkit = new BrowserTokenToolkit();
        const output = (await toolkit.convert({
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: TokenFormat.DTCG,
                    content: JSON.stringify({
                        semantic: {
                            color: {
                                action: { "$type": "color", "$value": "{primitive.color.brand}" },
                            },
                        },
                    }),
                },
            },
        }, "showcase"))[0]?.content;

        expect(output).toContain("Theme: base");
        expect(output).toContain("Theme: dark");
        expect(output).toContain("--primitive-color-brand");
    });

    it("rejects semantic errors before conversion and statistics", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                source: "tokens.json",
                format: TokenFormat.DTCG,
                content: JSON.stringify({
                    semantic: {
                        broken: { "$type": "color", "$value": "{primitive.color.missing}" },
                    },
                }),
            },
        };

        expect(() => toolkit.convert(input, PlatformFormat.CSS)).toThrow(BrowserTokenValidationError);
        expect(() => toolkit.stats(input)).toThrow(BrowserTokenValidationError);
    });

    it("loads additional HRDT documents as generated themes", async () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = await toolkit.convert({
            base: {
                source: "tokens.yaml",
                format: TokenFormat.HRDT,
                content: [
                    "primitive:\n  number:\n    opacity: 1",
                    "---",
                    "primitive:\n  number:\n    opacity: 0.5",
                ].join("\n"),
            },
        }, PlatformFormat.CSS);

        expect(outputs[0]?.content).toContain('data-theme="theme-1"');
    });

    it("reports HRDT YAML syntax errors instead of partial schema errors", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: {
                source: "tokens.yaml",
                format: TokenFormat.HRDT,
                content: "primitive:\n  number:\n    opacity: [1, 2\n  bad: : :\n",
            },
        });

        // Every YAML error is reported, each naming what the parser found -
        // not a schema path left over from a half-parsed document.
        expect(issues).not.toHaveLength(0);
        expect(issues.every((issue) => issue.sourcePath === "tokens.yaml")).toBe(true);
        expect(issues.every((issue) => issue.id.startsWith("yaml-"))).toBe(true);
        expect(issues.every((issue) => !issue.message.startsWith("/"))).toBe(true);
    });

    it("rejects a theme name that collides with a generated theme", async () => {
        const toolkit = new BrowserTokenToolkit();
        const hrdt = "primitive:\n  number:\n    opacity: 1";
        const input: BrowserTokenSet = {
            base: { source: "tokens.yaml", format: TokenFormat.HRDT, content: `${hrdt}\n---\n${hrdt}` },
            themes: {
                "theme-1": { source: "tokens.theme-1.yaml", format: TokenFormat.HRDT, content: hrdt },
            },
        };

        expect(await toolkit.check(input)).toEqual([
            expect.objectContaining({ id: "theme-name", sourcePath: "tokens.theme-1.yaml" }),
        ]);
        expect(() => toolkit.convert(input, TokenFormat.DTCG)).toThrow(BrowserTokenValidationError);
    });

    it("warns about ignored DESIGN.md values without blocking conversion", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: {
                source: "DESIGN.md",
                format: TokenFormat.DESIGN_MD,
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

        expect(await toolkit.check(input)).toEqual([
            expect.objectContaining({ id: "design-md-ignored-value", severity: "warning", sourcePath: "DESIGN.md" }),
        ]);
        expect((await toolkit.convert(input, PlatformFormat.CSS))[0]?.content).toContain("--colors-primary");
    });

    it("rejects a theme without documents", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: { source: "tokens.yaml", format: TokenFormat.HRDT, content: "primitive:\n  number:\n    opacity: 1" },
            themes: { dark: { source: "tokens.dark.yaml", format: TokenFormat.HRDT, content: "" } },
        });

        expect(issues).toEqual([
            expect.objectContaining({ id: "theme-name", sourcePath: "tokens.dark.yaml" }),
        ]);
    });

    it("attributes parser errors to the failing theme source", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "DESIGN.dark.md",
                    format: TokenFormat.DESIGN_MD,
                    content: "---\ncolors:\n  bad: not-a-color\n---\n\n## Colors\n",
                },
            },
        });

        expect(issues).toEqual([
            expect.objectContaining({ sourcePath: "DESIGN.dark.md" }),
        ]);
    });

    it("maps DESIGN.md theme references against base tokens", async () => {
        const toolkit = new BrowserTokenToolkit();
        const outputs = await toolkit.convert({
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
            themes: {
                dark: {
                    source: "tokens.dark.json",
                    format: TokenFormat.DTCG,
                    content: JSON.stringify({
                        semantic: {
                            color: {
                                action: { "$type": "color", "$value": "{primitive.color.brand}" },
                            },
                        },
                    }),
                },
            },
        }, TokenFormat.DESIGN_MD);

        expect(outputs.find((output) => output.themeName === "dark")?.content)
            .toContain("{colors.brand}");
    });

    it("rejects unsafe theme names before generating CSS", async () => {
        const toolkit = new BrowserTokenToolkit();
        const unsafe: BrowserTokenSet = {
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
            themes: {
                'dark\"] body { color: red }': {
                    source: "tokens.dark.json",
                    format: TokenFormat.DTCG,
                    content: "{}",
                },
            },
        };

        expect(await toolkit.check(unsafe)).toEqual([
            expect.objectContaining({ id: "theme-name" }),
        ]);
        expect(() => toolkit.convert(unsafe, PlatformFormat.CSS)).toThrow(BrowserTokenValidationError);
    });

    it("uses filename hints for malformed input", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({ base: { source: "broken.json", content: "{" } });

        expect(issues[0]?.sourcePath).toBe("broken.json");
        expect(issues[0]?.message).toMatch(/JSON|position|property name/i);
    });

    it("rejects output-only runtime input formats", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: {
                source: "tokens.css",
                format: "css" as BrowserInputFormat,
                content: ":root { --brand: blue; }",
            },
        });

        expect(issues).toEqual([
            expect.objectContaining({
                id: "schema",
                sourcePath: "tokens.css",
                message: expect.stringContaining("Unsupported browser token input format"),
            }),
        ]);
    });

    it("reports an empty base source as a structured browser issue", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: { source: "empty.yaml", format: TokenFormat.HRDT, content: "" },
        });

        expect(issues).toEqual([
            expect.objectContaining({
                id: "schema",
                sourcePath: "empty.yaml",
                message: "Token source contains no documents.",
            }),
        ]);
    });

    it("rejects DESIGN.md values that the reader cannot preserve", async () => {
        const toolkit = new BrowserTokenToolkit();
        const issues = await toolkit.check({
            base: {
                source: "DESIGN.md",
                format: TokenFormat.DESIGN_MD,
                content: "---\ncolors:\n  bad: 123\n---\n\n## Colors\n",
            },
        }, { scope: CheckScope.SCHEMA });

        expect(issues.length).toBeGreaterThan(0);
        // Reading reports before the schema does, naming the offending value
        // rather than the schema branch that did not match.
        expect(issues.every((issue) => issue.id === "invalid-value")).toBe(true);
    });

    it("returns separate files for multi-file output formats", async () => {
        const toolkit = new BrowserTokenToolkit();
        const input: BrowserTokenSet = {
            base: { source: "tokens.json", format: TokenFormat.DTCG, content: validDtcg },
        };

        expect(await toolkit.convert(input, PlatformFormat.SCSS)).toEqual([
            expect.objectContaining({ fileName: "tokens.base.scss" }),
        ]);
        expect(await toolkit.convert(input, PlatformFormat.ANDROID)).toEqual(expect.arrayContaining([
            expect.objectContaining({ fileName: expect.stringMatching(/^values\//) }),
        ]));
    });

    it("rejects conversion when schema validation fails", async () => {
        const toolkit = new BrowserTokenToolkit();
        const invalid: BrowserTokenSet = {
            base: {
                source: "invalid.json",
                format: TokenFormat.DTCG,
                content: "{",
            },
        };

        expect(() => toolkit.convert(invalid, PlatformFormat.CSS)).toThrow(BrowserTokenValidationError);
    });
});
