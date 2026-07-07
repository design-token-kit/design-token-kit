import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTailwindCssConverter } from "#/core/css/DtcgTailwindCssConverter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
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
        expect(css).toContain(":root {");
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
        expect(css).toContain("--font-weight-primitive-body: 500;");
        expect(css).toContain("--tracking-primitive-body: 0px;");
        expect(css).toContain("--leading-primitive-body: 1.5;");
    });

    it("flattens typography aliases into per-namespace references", () => {
        expect(css).toContain("--font-semantic-body: var(--font-primitive-body);");
        expect(css).toContain("--text-semantic-body: var(--text-primitive-body);");
        expect(css).toContain("--leading-semantic-body: var(--leading-primitive-body);");
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
        expect(generated).toContain("--font-weight-primitive-body: var(--font-weight-primitive-bold);");
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
