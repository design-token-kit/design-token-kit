import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTokenScssConverter } from "#/core/platforms/scss/DtcgTokenScssConverter";
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
import { DtcgList } from "#/core/model/DtcgList";

const FIXTURES = fileURLToPath(new URL("../css/fixtures", import.meta.url));
const sources = [
    `${FIXTURES}/tokens.json`,
    `${FIXTURES}/tokens.dark.json`,
];

describe("DtcgTokenScssConverter", () => {
    const converter = new DtcgTokenScssConverter();
    const children = (entries: Array<readonly [string, TokenGroup | TokenNode<unknown>]>) =>
        new Map<string, TokenGroup | TokenNode<unknown>>(entries);

    function doc(children: Map<string, TokenGroup | TokenNode<unknown>>): Dtcg {
        return new Dtcg(new TokenGroup({ children }));
    }

    describe("convert (with fixtures)", () => {
    let scss: string;

    beforeAll(async () => {
        scss = await converter.convert([sources[0]]);
    });

    it("converts color tokens from base file", () => {
        expect(scss).toContain("$primitive-color-teal-500: #10a5a5;\n");
    });

    it("converts dimension to px", () => {
        expect(scss).toContain("$primitive-spacing-4: 16px;\n");
    });

    it("converts alias to variable reference", () => {
        expect(scss).toContain("$semantic-color-bg-surface: $primitive-color-white;\n");
    });

    it("converts typography", () => {
        expect(scss).toContain('$primitive-typography-body: 500 16px/1.5 "Inter", "Arial", "sans-serif";\n');
    });

    it("converts gradient", () => {
        expect(scss).toContain("$primitive-gradient-brand: linear-gradient(180deg, #10a5a5 0%, color(srgb 0.118 0.161 0.231) 100%);\n");
    });

    it("ends with trailing newline", () => {
        expect(scss.endsWith("\n")).toBe(true);
    });
});

describe("convertThemes (with fixtures)", () => {
    let outputs: ReadonlyArray<{ themeName: string; isBase: boolean; content: string }>;

    beforeAll(async () => {
        outputs = await converter.convertThemes(sources);
    });

    it("returns base and dark theme", () => {
        expect(outputs).toHaveLength(2);
        expect(outputs[0].themeName).toBe("base");
        expect(outputs[0].isBase).toBe(true);
        expect(outputs[1].themeName).toBe("dark");
        expect(outputs[1].isBase).toBe(false);
    });

    it("overrides dark theme values", () => {
        expect(outputs[0].content).toContain("$semantic-color-bg-surface: $primitive-color-white;\n");
        expect(outputs[1].content).toContain("$semantic-color-bg-surface: $primitive-color-slate-100;\n");
    });
});

it("converts a simple color token", () => {
        const result = converter.convertDocument(doc(new Map([
            ["color-brand", new ColorToken(new ColorValue("srgb", [0.063, 0.647, 0.647], 1, "#10a5a5"))],
        ])));
        expect(result).toBe("$color-brand: #10a5a5;\n");
    });

    it("converts color with alpha using color()", () => {
        const result = converter.convertDocument(doc(new Map([
            ["overlay", new ColorToken(new ColorValue("srgb", [0, 0, 0], 0.4, "#000000"))],
        ])));
        expect(result).toBe("$overlay: color(srgb 0 0 0 / 0.4);\n");
    });

    it("converts dimension to px", () => {
        const result = converter.convertDocument(doc(new Map([
            ["spacing-4", new DimensionToken(new DimensionValue(16, "px"))],
        ])));
        expect(result).toBe("$spacing-4: 16px;\n");
    });

    it("converts duration to ms", () => {
        const result = converter.convertDocument(doc(new Map([
            ["duration-base", new DurationToken(new DurationValue(200, "ms"))],
        ])));
        expect(result).toBe("$duration-base: 200ms;\n");
    });

    it("converts cubic-bezier", () => {
        const result = converter.convertDocument(doc(new Map([
            ["easing", new CubicBezierToken(new CubicBezierValue(0.2, 0.8, 0.2, 1))],
        ])));
        expect(result).toBe("$easing: cubic-bezier(0.2, 0.8, 0.2, 1);\n");
    });

    it("converts number as-is", () => {
        const result = converter.convertDocument(doc(new Map([
            ["weight-bold", new NumberToken(700)],
        ])));
        expect(result).toBe("$weight-bold: 700;\n");
    });

    it("converts string value", () => {
        const result = converter.convertDocument(doc(new Map([
            ["family", new FontFamilyToken("Inter")],
        ])));
        expect(result).toBe("$family: Inter;\n");
    });

    it("converts alias to SCSS variable reference", () => {
        const result = converter.convertDocument(doc(new Map([
            ["semantic-bg", new ColorToken(new TokenReference("primitive-color-white"))],
        ])));
        expect(result).toBe("$semantic-bg: $primitive-color-white;\n");
    });

    it("converts typography with TokenReference font family", () => {
        const result = converter.convertDocument(doc(new Map([
            ["typography-body", new TypographyToken(new TypographyValue(
                new TokenReference("brandFonts-sans"),
                new TokenReference("size-body"),
                new TokenReference("weight-body"),
                new DimensionValue(0, "px"),
                new TokenReference("lineHeight-body"),
            ))],
        ])));
        expect(result).toBe("$typography-body: $weight-body $size-body/$lineHeight-body $brandFonts-sans;\n");
    });

    it("converts typography with array font family", () => {
        const result = converter.convertDocument(doc(new Map([
            ["typography", new TypographyToken(new TypographyValue(
                ["Inter", new TokenReference("brandFonts-sans"), "sans-serif"],
                new DimensionValue(16, "px"),
                500,
                new DimensionValue(0, "px"),
                1.5,
            ))],
        ])));
        expect(result).toBe('$typography: 500 16px/1.5 "Inter", $brandFonts-sans, "sans-serif";\n');
    });

    it("converts typography with string font family", () => {
        const result = converter.convertDocument(doc(new Map([
            ["typography", new TypographyToken(new TypographyValue(
                "Arial",
                new DimensionValue(14, "px"),
                "bold",
                new DimensionValue(0, "px"),
                1.2,
            ))],
        ])));
        expect(result).toBe('$typography: bold 14px/1.2 "Arial";\n');
    });

    it("converts single shadow layer", () => {
        const result = converter.convertDocument(doc(new Map([
            ["shadow-sm", new ShadowToken(new ShadowLayer(
                new ColorValue("srgb", [0, 0, 0], 0.2),
                new DimensionValue(0, "px"),
                new DimensionValue(1, "px"),
                new DimensionValue(2, "px"),
                new DimensionValue(0, "px"),
            ))],
        ])));
        expect(result).toBe("$shadow-sm: 0px 1px 2px 0px color(srgb 0 0 0 / 0.2);\n");
    });

    it("converts shadow list with inset and ref", () => {
        const result = converter.convertDocument(doc(new Map([
            ["shadow", new ShadowToken([
                new ShadowLayer(
                    new TokenReference("color-brand"),
                    new DimensionValue(0, "px"),
                    new DimensionValue(2, "px"),
                    new DimensionValue(8, "px"),
                    new DimensionValue(0, "px"),
                    true,
                ),
                new TokenReference("shadow-sm"),
            ])],
        ])));
        expect(result).toBe("$shadow: inset 0px 2px 8px 0px $color-brand, $shadow-sm;\n");
    });

    it("converts border with string style", () => {
        const result = converter.convertDocument(doc(new Map([
            ["border", new BorderToken(new BorderValue(
                new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"),
                new DimensionValue(2, "px"),
                "solid" as const,
            ))],
        ])));
        expect(result).toBe("$border: 2px solid #ff0000;\n");
    });

    it("converts border with stroke style ref", () => {
        const result = converter.convertDocument(doc(children([
            ["stroke", new StrokeStyleToken("dashed" as const)],
            ["border", new BorderToken(new BorderValue(
                new TokenReference("color-brand"),
                new DimensionValue(1, "px"),
                new TokenReference("stroke"),
            ))],
        ])));
        expect(result).toBe("$stroke: dashed;\n$border: 1px $stroke $color-brand;\n");
    });

    it("converts border with StrokeStyleObject (renders as dashed)", () => {
        const result = converter.convertDocument(doc(new Map([
            ["border", new BorderToken(new BorderValue(
                new ColorValue("srgb", [0, 0, 1], 1, "#0000ff"),
                new DimensionValue(1, "px"),
                new StrokeStyleObject([new DimensionValue(2, "px")], "round"),
            ))],
        ])));
        expect(result).toBe("$border: 1px dashed #0000ff;\n");
    });

    it("converts transition token", () => {
        const result = converter.convertDocument(doc(children([
            ["duration", new DurationToken(new DurationValue(200, "ms"))],
            ["easing", new CubicBezierToken(new CubicBezierValue(0.2, 0.8, 0.2, 1))],
            ["transition", new TransitionToken(new TransitionValue(
                new TokenReference("duration"),
                new TokenReference("duration"),
                new TokenReference("easing"),
            ))],
        ])));
        expect(result).toBe("$duration: 200ms;\n$easing: cubic-bezier(0.2, 0.8, 0.2, 1);\n$transition: $duration $easing $duration;\n");
    });

    it("converts transition with literal values", () => {
        const result = converter.convertDocument(doc(new Map([
            ["transition", new TransitionToken(new TransitionValue(
                new DurationValue(300, "ms"),
                new DurationValue(100, "ms"),
                new CubicBezierValue(0.42, 0, 0.58, 1),
            ))],
        ])));
        expect(result).toBe("$transition: 300ms cubic-bezier(0.42, 0, 0.58, 1) 100ms;\n");
    });

    it("converts gradient with ref position and ref stop", () => {
        const result = converter.convertDocument(doc(children([
            ["gradient", new GradientToken([
                new GradientStop(
                    new TokenReference("color-brand"),
                    new TokenReference("progress-start"),
                ),
                new TokenReference("gradientStops-end"),
            ])],
            ["gradientStops", new TokenGroup({ children: new Map([
                ["end", new ColorToken(new ColorValue("srgb", [0, 0, 1], 1, "#0000ff"))],
            ]) })],
            ["progress", new TokenGroup({ children: new Map([
                ["start", new NumberToken(0.5)],
            ]) })],
            ["color-brand", new ColorToken(new ColorValue("srgb", [0.063, 0.647, 0.647], 1, "#10a5a5"))],
        ])));
        expect(result).toContain("$gradient: linear-gradient(180deg, $color-brand calc($progress-start * 100%), $gradientStops-end);");
    });

    it("converts gradient with direct color and numeric position", () => {
        const result = converter.convertDocument(doc(new Map([
            ["gradient", new GradientToken([
                new GradientStop(
                    new ColorValue("srgb", [0.063, 0.647, 0.647], 1, "#10a5a5"),
                    0,
                ),
                new GradientStop(
                    new ColorValue("srgb", [0.118, 0.161, 0.231], 1),
                    1,
                ),
            ])],
        ])));
        expect(result).toContain("#10a5a5 0%");
        expect(result).toContain("color(srgb 0.118 0.161 0.231) 100%");
    });

    it("converts array of strings", () => {
        const result = converter.convertDocument(doc(new Map([
            ["fontFamily", new FontFamilyToken(["Inter", "Arial", "sans-serif"])],
        ])));
        expect(result).toBe('$fontFamily: "Inter", "Arial", "sans-serif";\n');
    });

    it("converts array of only TokenReferences", () => {
        const result = converter.convertDocument(doc(new Map([
            ["fonts", new FontFamilyToken([new TokenReference("a"), new TokenReference("b")])],
        ])));
        expect(result).toBe("$fonts: $a, $b;\n");
    });

    it("skips unsupported value types", () => {
        class UnknownToken extends TokenNode<{ foo: string }> {
            constructor() { super(undefined, { foo: "bar" }); }
        }
        const result = converter.convertDocument(doc(new Map([
            ["unsupported", new UnknownToken()],
        ])));
        expect(result).toBe("");
    });

    it("skips unsupported values nested in a group", () => {
        class UnknownToken extends TokenNode<{ foo: string }> {
            constructor() { super(undefined, { foo: "bar" }); }
        }
        const result = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["group", new TokenGroup({
                    children: new Map([
                        ["unsupported", new UnknownToken()],
                    ]),
                })],
            ]),
        })));
        expect(result).toBe("");
    });

    it("skips empty array values", () => {
        const result = converter.convertDocument(doc(new Map([
            ["empty", new FontFamilyToken([])],
        ])));
        expect(result).toBe("");
    });

    it("handles deeply nested groups", () => {
        const result = converter.convertDocument(new Dtcg(new TokenGroup({
            children: new Map([
                ["primitive", new TokenGroup({
                    children: new Map([
                        ["color", new TokenGroup({
                            children: new Map([
                                ["teal-500", new ColorToken(new ColorValue("srgb", [0.063, 0.647, 0.647], 1, "#10a5a5"))],
                            ]),
                        })],
                        ["spacing", new TokenGroup({
                            children: new Map([
                                ["4", new DimensionToken(new DimensionValue(16, "px"))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));
        expect(result).toContain("$primitive-color-teal-500: #10a5a5;\n");
        expect(result).toContain("$primitive-spacing-4: 16px;\n");
    });

    it("handles top-level tokens", () => {
        const result = converter.convertDocument(doc(children([
            ["color-brand", new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"))],
            ["spacing-sm", new DimensionToken(new DimensionValue(4, "px"))],
        ])));
        expect(result).toBe("$color-brand: #ff0000;\n$spacing-sm: 4px;\n");
    });

    it("returns empty string for empty document", () => {
        expect(converter.convertDocument(new Dtcg(new TokenGroup()))).toBe("");
    });

    it("ends with trailing newline", () => {
        const result = converter.convertDocument(doc(new Map([
            ["color", new ColorToken(new ColorValue("srgb", [0, 0, 0], 1, "#000000"))],
        ])));
        expect(result.endsWith("\n")).toBe(true);
    });

    describe("convertList", () => {
        it("renders a base document", () => {
            const list = new DtcgList(
                new Dtcg(new TokenGroup({ children: children([
                    ["color", new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"))],
                ]) })),
            );
            expect(converter.convertList(list)).toBe("$color: #ff0000;\n");
        });

        it("throws when themes exist", () => {
            const list = new DtcgList(
                new Dtcg(new TokenGroup()),
                new Map([["dark", new Dtcg(new TokenGroup())]]),
            );
            expect(() => converter.convertList(list)).toThrow(
                "SCSS multi-theme output produces multiple files; use convertThemes()",
            );
        });
    });

    describe("convertThemeList", () => {
        it("returns base and theme outputs", () => {
            const list = new DtcgList(
                new Dtcg(new TokenGroup({ children: children([
                    ["color", new ColorToken(new ColorValue("srgb", [1, 1, 1], 1, "#ffffff"))],
                ]) })),
                new Map([["dark", new Dtcg(new TokenGroup({ children: children([
                    ["color", new ColorToken(new ColorValue("srgb", [0, 0, 0], 1, "#000000"))],
                ]) }))]]),
            );
            const outputs = converter.convertThemeList(list);
            expect(outputs).toHaveLength(2);
            expect(outputs[0].themeName).toBe("base");
            expect(outputs[0].isBase).toBe(true);
            expect(outputs[0].content).toBe("$color: #ffffff;\n");
            expect(outputs[1].themeName).toBe("dark");
            expect(outputs[1].isBase).toBe(false);
            expect(outputs[1].content).toBe("$color: #000000;\n");
        });

        it("returns only base when no themes", () => {
            const list = new DtcgList(
                new Dtcg(new TokenGroup({ children: children([
                    ["color", new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"))],
                ]) })),
            );
            const outputs = converter.convertThemeList(list);
            expect(outputs).toHaveLength(1);
            expect(outputs[0].themeName).toBe("base");
            expect(outputs[0].isBase).toBe(true);
        });
    });

    describe("custom separator", () => {
        it("uses custom separator in variable names", () => {
            const customConverter = new DtcgTokenScssConverter({ separator: "_" });
            const result = customConverter.convertDocument(new Dtcg(new TokenGroup({
                children: children([
                    ["primitive", new TokenGroup({
                        children: children([
                            ["color", new TokenGroup({
                                children: children([
                                    ["teal-500", new ColorToken(new ColorValue("srgb", [0.063, 0.647, 0.647], 1, "#10a5a5"))],
                                ]),
                            })],
                        ]),
                    })],
                ]),
            })));
            expect(result).toContain("$primitive_color_teal-500: #10a5a5;\n");
        });
    });
});
