import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTokenCssConverter } from "#/core/css/DtcgTokenCssConverter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { CubicBezierToken } from "#/core/model/tokens/CubicBezierToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { DurationToken } from "#/core/model/tokens/DurationToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { StrokeStyleToken } from "#/core/model/tokens/StrokeStyleToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

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

    it("ends with trailing newline", () => {
        expect(css.endsWith("\n")).toBe(true);
    });

    it("returns an empty string for a document without serializable tokens", () => {
        expect(converter.convertDocument(new Dtcg(new TokenGroup()))).toBe("");
    });

    it("serializes direct top-level tokens and complex css value branches", () => {
        const generated = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["brand", new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"))],
                ["duration", new DurationToken(new DurationValue(200, "ms"))],
                ["easing", new CubicBezierToken(new CubicBezierValue(0.2, 0.8, 0.2, 1))],
                ["fontFamily", new FontFamilyToken([
                    "Inter",
                    new TokenReference("brandFonts.sans"),
                    "sans-serif",
                ])],
                ["brandFonts", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["sans", new FontFamilyToken("Arial")],
                    ]),
                })],
                ["shadow", new ShadowToken([
                    new ShadowLayer(
                        new TokenReference("brand"),
                        new DimensionValue(0, "px"),
                        new DimensionValue(2, "px"),
                        new DimensionValue(8, "px"),
                        new DimensionValue(0, "px"),
                        true,
                    ),
                    new TokenReference("shadowAlias"),
                ])],
                ["shadowAlias", new ShadowToken(new ShadowLayer(
                    new ColorValue("srgb", [0, 0, 0], 0.2),
                    new DimensionValue(0, "px"),
                    new DimensionValue(1, "px"),
                    new DimensionValue(2, "px"),
                    new DimensionValue(0, "px"),
                ))],
                ["stroke", new StrokeStyleToken(new StrokeStyleObject([new DimensionValue(2, "px")], "round"))],
                ["border", new BorderToken(new BorderValue(
                    new TokenReference("brand"),
                    new DimensionValue(1, "px"),
                    new TokenReference("stroke"),
                ))],
                ["transition", new TransitionToken(new TransitionValue(
                    new TokenReference("duration"),
                    new TokenReference("duration"),
                    new TokenReference("easing"),
                ))],
                ["gradient", new GradientToken([
                    new GradientStop(new TokenReference("brand"), new TokenReference("progress.start")),
                    new TokenReference("gradientStops.end"),
                ])],
                ["gradientStops", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["end", new ColorToken(new ColorValue("srgb", [0, 0, 1], 1, "#0000ff"))],
                    ]),
                })],
                ["progress", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["start", new NumberToken(0.5)],
                    ]),
                })],
                ["typography", new TypographyToken(new TypographyValue(
                    new TokenReference("brandFonts.sans"),
                    new TokenReference("size.body"),
                    new TokenReference("weight.body"),
                    new DimensionValue(0, "px"),
                    new TokenReference("lineHeight.body"),
                ))],
                ["size", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["body", new DimensionToken(new DimensionValue(16, "px"))],
                    ]),
                })],
                ["weight", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["body", new NumberToken(500)],
                    ]),
                })],
                ["lineHeight", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["body", new NumberToken(1.5)],
                    ]),
                })],
            ]),
        })));

        expect(generated).toContain("--brand: #ff0000;");
        expect(generated).toContain('--fontFamily: "Inter", var(--brandFonts-sans), "sans-serif";');
        expect(generated).toContain("--shadow: inset 0px 2px 8px 0px var(--brand), var(--shadowAlias);");
        expect(generated).toContain("--border: 1px var(--stroke) var(--brand);");
        expect(generated).toContain("--transition: var(--duration) var(--easing) var(--duration);");
        expect(generated).toContain("--gradient: linear-gradient(180deg, var(--brand) calc(var(--progress-start) * 100%), var(--gradientStops-end));");
        expect(generated).toContain("--typography: var(--weight-body) var(--size-body)/var(--lineHeight-body) var(--brandFonts-sans);");
    });
});
