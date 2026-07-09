import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTailwindCssConverter } from "#/core/platforms/tailwind/DtcgTailwindCssConverter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { DurationToken } from "#/core/model/tokens/DurationToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

const FIXTURES = fileURLToPath(new URL("fixtures", import.meta.url));
const sources = [
    `${FIXTURES}/tokens.json`,
    `${FIXTURES}/tokens.dark.json`,
];

describe("DtcgTailwindCssConverter", () => {
    const converter = new DtcgTailwindCssConverter();
    let css: string;

    beforeAll(async () => {
        css = await converter.convert(sources);
    });

    it("adds tailwind import", () => {
        expect(css).toContain("@import 'tailwindcss';");
    });

    it("renders base tokens in @theme", () => {
        expect(css).toContain("@theme {");
        expect(css).not.toContain(":root {");
        expect(css).toContain("--color-primitive-teal-500: #10a5a5;");
        expect(css).toContain("--background-image-primitive-brand: linear-gradient(180deg, #10a5a5 0%, #1e293b 100%);");
        expect(css).toContain("--spacing-primitive-4: 16px;");
    });

    it("renders color aliases against mapped tailwind variables", () => {
        expect(css).toContain("--color-semantic-bg-surface: var(--color-primitive-white);");
    });

    it("renders gradient aliases against mapped tailwind variables", () => {
        expect(css).toContain("--background-image-semantic-surface-brand: var(--background-image-primitive-brand);");
    });

    it("flattens transition tokens into duration and ease namespaces", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["transition", new TokenGroup({
                            children: new Map([
                                ["emphasis", new TransitionToken(new TransitionValue(
                                    new DurationValue(240, "ms"),
                                    new DurationValue(80, "ms"),
                                    new CubicBezierValue(0.2, 0.8, 0.2, 1),
                                ))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--duration-primitive-emphasis: 240ms;");
        expect(generated).toContain("--ease-primitive-emphasis: cubic-bezier(0.2, 0.8, 0.2, 1);");
        expect(generated).not.toContain("--duration-primitive-emphasis-delay:");
    });

    it("flattens transition aliases into duration and ease references", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["transition", new TokenGroup({
                            children: new Map([
                                ["emphasis", new TransitionToken(new TransitionValue(
                                    new DurationValue(240, "ms"),
                                    new DurationValue(80, "ms"),
                                    new CubicBezierValue(0.2, 0.8, 0.2, 1),
                                ))],
                            ]),
                        })],
                    ]),
                })],
                ["semantic", new TokenGroup({
                    children: new Map([
                        ["motion", new TokenGroup({
                            children: new Map([
                                ["emphasis", new TransitionToken(new TokenReference("primitive.transition.emphasis"))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--duration-semantic-emphasis: var(--duration-primitive-emphasis);");
        expect(generated).toContain("--ease-semantic-emphasis: var(--ease-primitive-emphasis);");
    });

    it("flattens typography tokens into tailwind namespaces", () => {
        expect(css).toContain('--font-primitive-body: "Inter", "Arial", "sans-serif";');
        expect(css).toContain("--text-primitive-body: 16px;");
        expect(css).toContain("--text-primitive-body--line-height: 1.5;");
        expect(css).toContain("--text-primitive-body--letter-spacing: 0px;");
        expect(css).toContain("--text-primitive-body--font-weight: 500;");
        expect(css).not.toContain("--font-weight-primitive-body: 500;");
        expect(css).not.toContain("--tracking-primitive-body: 0px;");
        expect(css).not.toContain("--leading-primitive-body: 1.5;");
    });

    it("normalizes font weight keywords to numeric values", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["fontWeight", new TokenGroup({
                            children: new Map([
                                ["regular", new FontWeightToken("regular")],
                            ]),
                        })],
                        ["typography", new TokenGroup({
                            children: new Map([
                                ["body", new TypographyToken(new TypographyValue(
                                    ["Inter", "sans-serif"],
                                    new DimensionValue(14, "px"),
                                    "regular",
                                    new DimensionValue(0, "px"),
                                    1.4,
                                ))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--font-weight-primitive-regular: 400;");
        expect(generated).toContain("--text-primitive-body--font-weight: 400;");
        expect(generated).not.toContain("--font-weight-primitive-regular: regular;");
        expect(generated).not.toContain("--text-primitive-body--font-weight: regular;");
    });

    it("flattens typography aliases into per-namespace references", () => {
        expect(css).toContain("--font-semantic-body: var(--font-primitive-body);");
        expect(css).toContain("--text-semantic-body: var(--text-primitive-body);");
        expect(css).toContain("--text-semantic-body--line-height: var(--text-primitive-body--line-height);");
        expect(css).toContain("--text-semantic-body--letter-spacing: var(--text-primitive-body--letter-spacing);");
        expect(css).toContain("--text-semantic-body--font-weight: var(--text-primitive-body--font-weight);");
        expect(css).not.toContain("--leading-semantic-body: var(--leading-primitive-body);");
    });

    it("renders theme overrides outside @theme", () => {
        expect(css).toContain("[data-theme='dark'] {");
        expect(css).toContain("--color-primitive-slate-100: #1e293b;");
        expect(css).toContain("--color-semantic-bg-surface: var(--color-primitive-slate-100);");
    });

    it("supports shadow-dom and custom theme selectors", async () => {
        const shadowCss = await new DtcgTailwindCssConverter({
            baseSelector: ":host",
            themeSelector: ":host([data-theme='{theme}'])",
        }).convert(sources);

        expect(shadowCss).toContain(":host {");
        expect(shadowCss).toContain("--color-primitive-white: #ffffff;");
        expect(shadowCss).toContain(":host([data-theme='dark']) {");
    });

    it("ends with trailing newline", () => {
        expect(css.endsWith("\n")).toBe(true);
    });

    it("maps breakpoint and number-based font weight tokens", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["breakpoint", new TokenGroup({
                    children: new Map([
                        ["3xl", new DimensionToken(new DimensionValue(1920, "px"))],
                    ]),
                })],
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["font", new TokenGroup({
                            children: new Map([
                                ["weight", new TokenGroup({
                                    children: new Map([
                                        ["bold", new NumberToken(700)],
                                    ]),
                                })],
                            ]),
                        })],
                        ["typography", new TokenGroup({
                            children: new Map([
                                ["body", new TypographyToken(new TypographyValue(
                                    ["Inter", "sans-serif"],
                                    new DimensionValue(14, "px"),
                                    new TokenReference("primitive.font.weight.bold"),
                                    new DimensionValue(0, "px"),
                                    1.4,
                                ))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--breakpoint-3xl: 1920px;");
        expect(generated).toContain("--font-weight-primitive-bold: 700;");
        expect(generated).toContain("--text-primitive-body--font-weight: var(--font-weight-primitive-bold);");
    });

    it("maps dimension tokens with explicit tailwind breakpoint marker to --breakpoint-*", () => {
        const generated = renderDimensionDoc("layout", "desktop", {
            "design-token-kit": {
                tailwindNamespace: "breakpoint",
            },
        });

        expect(generated).toContain("--breakpoint-layout-desktop: 1920px;");
    });

    it("maps breakpoint-like paths to --breakpoint-*", () => {
        const generated = renderDimensionDoc("breakpoint", "3xl");
        expect(generated).toContain("--breakpoint-3xl: 1920px;");
    });

    it("maps screen-like paths to --breakpoint-*", () => {
        const generated = renderNestedDimensionDoc(["screens", "desktop"]);
        expect(generated).toContain("--breakpoint-desktop: 1920px;");
    });

    it("maps plain dimension tokens to --spacing-* by default", () => {
        const generated = renderNestedDimensionDoc(["spacing", "md"], 16);
        expect(generated).toContain("--spacing-md: 16px;");
    });

    it("maps flat dimension token names to tailwind-specific namespaces", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["dimension", new TokenGroup({
                            children: new Map([
                                ["radius-100", new DimensionToken(new DimensionValue(4, "px"))],
                                ["font-size-200", new DimensionToken(new DimensionValue(14, "px"))],
                                ["letter-spacing-wide", new DimensionToken(new DimensionValue(0.4, "px"))],
                                ["border-width-100", new DimensionToken(new DimensionValue(1, "px"))],
                            ]),
                        })],
                        ["number", new TokenGroup({
                            children: new Map([
                                ["line-height-tight", new NumberToken(1.2)],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--radius-primitive-100: 4px;");
        expect(generated).toContain("--text-primitive-200: 14px;");
        expect(generated).toContain("--tracking-primitive-wide: 0.4px;");
        expect(generated).toContain("--leading-primitive-tight: 1.2;");
        expect(generated).not.toContain("border-width-100");
        expect(generated).not.toContain("--spacing-primitive-radius-100");
        expect(generated).not.toContain("--spacing-primitive-font-size-200");
        expect(generated).not.toContain("--spacing-primitive-letter-spacing-wide");
    });

    it("deduplicates colliding declarations from overlapping token types", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["fontFamily", new TokenGroup({
                            children: new Map([
                                ["display", new FontFamilyToken(["Sora", "Arial", "sans-serif"])],
                            ]),
                        })],
                        ["typography", new TokenGroup({
                            children: new Map([
                                ["display", new TypographyToken(new TypographyValue(
                                    ["Sora", "Arial", "sans-serif"],
                                    new DimensionValue(48, "px"),
                                    "bold",
                                    new DimensionValue(-0.8, "px"),
                                    1.1,
                                ))],
                            ]),
                        })],
                        ["duration", new TokenGroup({
                            children: new Map([
                                ["fast", new DurationToken(new DurationValue(120, "ms"))],
                            ]),
                        })],
                        ["transition", new TokenGroup({
                            children: new Map([
                                ["fast", new TransitionToken(new TransitionValue(
                                    new DurationValue(120, "ms"),
                                    new DurationValue(0, "ms"),
                                    new CubicBezierValue(0.2, 0, 0, 1),
                                ))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        const fontMatches = generated.match(/--font-primitive-display:/g) ?? [];
        const durationMatches = generated.match(/--duration-primitive-fast:/g) ?? [];

        expect(fontMatches).toHaveLength(1);
        expect(durationMatches).toHaveLength(1);
    });

    it("gives explicit breakpoint marker priority over fallback path logic", () => {
        const generated = renderNestedDimensionDoc(
            ["spacing", "desktop"],
            1920,
            {
                "design-token-kit": {
                    tailwindNamespace: "breakpoint",
                },
            },
        );

        expect(generated).toContain("--breakpoint-spacing-desktop: 1920px;");
        expect(generated).not.toContain("--spacing-desktop: 1920px;");
    });
});

function renderDimensionDoc(
    group: string,
    tokenName: string,
    extensions?: Record<string, unknown>,
): string {
    return renderNestedDimensionDoc([group, tokenName], 1920, extensions);
}

function renderNestedDimensionDoc(
    path: string[],
    value = 1920,
    extensions?: Record<string, unknown>,
): string {
    const converter = new DtcgTailwindCssConverter();
    return converter.convertDocument(new Dtcg(buildGroup(path, value, extensions)));
}

function buildGroup(
    path: string[],
    value: number,
    extensions?: Record<string, unknown>,
): TokenGroup {
    const [head, ...rest] = path;
    if (!head) {
        throw new Error("Path must not be empty");
    }

    if (rest.length === 0) {
        return new TokenGroup({
            children: new Map([
                [head, new DimensionToken(new DimensionValue(value, "px"), undefined, undefined, extensions)],
            ]),
        });
    }

    return new TokenGroup({
        children: new Map([
            [head, buildGroup(rest, value, extensions)],
        ]),
    });
}
