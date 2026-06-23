import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTokenCssConverter } from "#/core/css/DtcgTokenCssConverter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { ColorValue } from "#/core/model/values/ColorValue";

const FIXTURES = fileURLToPath(new URL("fixtures", import.meta.url));
const sources = [
    `${FIXTURES}/tokens.json`,
    `${FIXTURES}/tokens.dark.json`,
];

describe("DtcgTokenCssConverter", () => {
    const converter = new DtcgTokenCssConverter();
    let css: string;

    beforeAll(async () => {
        css = await converter.convert(sources);
    });

    it("generates :root block", () => {
        expect(css).toContain(":root {");
    });

    it("generates theme block", () => {
        expect(css).toContain(':root[data-theme="dark"] {');
    });

    it("converts color with alpha=1 using hex", () => {
        expect(css).toContain("--primitive-color-teal-500: #10a5a5");
    });

    it("converts color with alpha<1 using color() ignoring hex", () => {
        expect(css).toContain("--primitive-color-overlay: color(srgb 0 0 0 / 0.4)");
        expect(css).not.toContain("--primitive-color-overlay: #000000");
    });

    it("converts native CSS color spaces without color()", () => {
        const nativeColorCss = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["color", new TokenGroup({
                            children: new Map([
                                ["hsl", new ColorToken(new ColorValue("hsl", [0, 100, 80]))],
                                ["hsl-alpha", new ColorToken(new ColorValue("hsl", [0, 100, 50], 0.5))],
                                ["hwb", new ColorToken(new ColorValue("hwb", [0, 10, 20]))],
                                ["lab", new ColorToken(new ColorValue("lab", [50, 20, -30]))],
                                ["lch", new ColorToken(new ColorValue("lch", [50, 40, 120]))],
                                ["oklab", new ColorToken(new ColorValue("oklab", [0.5, 0.1, -0.1]))],
                                ["oklch", new ColorToken(new ColorValue("oklch", [0.5, 0.2, 120]))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(nativeColorCss).toContain("--primitive-color-hsl: hsl(0 100% 80%)");
        expect(nativeColorCss).toContain("--primitive-color-hsl-alpha: hsl(0 100% 50% / 0.5)");
        expect(nativeColorCss).toContain("--primitive-color-hwb: hwb(0 10% 20%)");
        expect(nativeColorCss).toContain("--primitive-color-lab: lab(50% 20 -30)");
        expect(nativeColorCss).toContain("--primitive-color-lch: lch(50% 40 120)");
        expect(nativeColorCss).toContain("--primitive-color-oklab: oklab(0.5 0.1 -0.1)");
        expect(nativeColorCss).toContain("--primitive-color-oklch: oklch(0.5 0.2 120)");
        expect(nativeColorCss).not.toContain("color(hsl");
        expect(nativeColorCss).not.toContain("color(hwb");
        expect(nativeColorCss).not.toContain("color(lab");
        expect(nativeColorCss).not.toContain("color(lch");
        expect(nativeColorCss).not.toContain("color(oklab");
        expect(nativeColorCss).not.toContain("color(oklch");
    });

    it("keeps generic CSS color spaces in color()", () => {
        const displayP3Css = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["color", new TokenGroup({
                            children: new Map([
                                ["brand", new ColorToken(new ColorValue("display-p3", [1, 0.5, 0], 0.8))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(displayP3Css).toContain("--primitive-color-brand: color(display-p3 1 0.5 0 / 0.8)");
    });

    it("converts dimension to px", () => {
        expect(css).toContain("--primitive-spacing-4: 16px");
    });

    it("converts duration to ms", () => {
        expect(css).toContain("--primitive-transition-base: 200ms");
    });

    it("converts number as-is", () => {
        expect(css).toContain("--primitive-font-weight-bold: 700");
    });

    it("converts alias to var()", () => {
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-white)");
    });

    it("converts typography tokens to CSS custom properties", () => {
        expect(css).toContain('--primitive-typography-body: 500 16px/1.5 "Inter", "Arial", "sans-serif"');
        expect(css).toContain("--semantic-text-body: var(--primitive-typography-body)");
    });

    it("converts gradient tokens to CSS custom properties", () => {
        expect(css).toContain("--primitive-gradient-brand: linear-gradient(180deg, #10a5a5 0%, color(srgb 0.118 0.161 0.231) 100%)");
        expect(css).toContain("--semantic-surface-brand: var(--primitive-gradient-brand)");
    });

    it("overrides dark theme values", () => {
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-white)");
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-slate-100)");
    });
});
