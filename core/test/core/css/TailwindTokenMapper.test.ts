import { describe, expect, it } from "vitest";
import { TailwindTokenMapper } from "#/core/platforms/tailwind/TailwindTokenMapper";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { CubicBezierToken } from "#/core/model/tokens/CubicBezierToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";

describe("TailwindTokenMapper", () => {
    const mapper = new TailwindTokenMapper();

    it("maps direct top-level tokens and strips namespace-like segments", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["color", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["brand", new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"))],
                    ]),
                })],
                ["fontFamily", new FontFamilyToken("Inter")],
                ["fontWeight", new FontWeightToken(600)],
                ["ease", new CubicBezierToken(new CubicBezierValue(0.2, 0.8, 0.2, 1))],
                ["screens", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["desktop", new DimensionToken(new DimensionValue(1440, "px"))],
                    ]),
                })],
            ]),
        })));

        expect(declarations).toEqual(expect.arrayContaining([
            { property: "--color-brand", value: "#ff0000" },
            { property: "--font-fontFamily", value: "Inter" },
            { property: "--font-weight-fontWeight", value: "600" },
            { property: "--ease-ease", value: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
            { property: "--breakpoint-desktop", value: "1440px" },
        ]));
    });

    it("maps radius-like dimension paths to the radius namespace", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["radius", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["lg", new DimensionToken(new DimensionValue(12, "px"))],
                    ]),
                })],
            ]),
        })));

        expect(declarations).toContainEqual({ property: "--radius-lg", value: "12px" });
    });

    it("maps shadow, gradient, and namespace-aware references", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["primitive", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["color", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["brand", new ColorToken(new ColorValue("srgb", [0, 0, 0], 1, "#000000"))],
                            ]),
                        })],
                        ["spacing", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["half", new DimensionToken(new DimensionValue(0.5, "px"))],
                            ]),
                        })],
                        ["shadow", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["card", new ShadowToken([
                                    new ShadowLayer(
                                        new TokenReference("primitive.color.brand"),
                                        new DimensionValue(0, "px"),
                                        new DimensionValue(2, "px"),
                                        new DimensionValue(8, "px"),
                                        new DimensionValue(0, "px"),
                                        true,
                                    ),
                                    new TokenReference("primitive.shadow.soft"),
                                ])],
                                ["soft", new ShadowToken(new ShadowLayer(
                                    new ColorValue("srgb", [0, 0, 0], 0.1),
                                    new DimensionValue(0, "px"),
                                    new DimensionValue(1, "px"),
                                    new DimensionValue(2, "px"),
                                    new DimensionValue(0, "px"),
                                ))],
                            ]),
                        })],
                        ["gradient", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["brand", new GradientToken([
                                    new GradientStop(new TokenReference("primitive.color.brand"), new TokenReference("primitive.spacing.half")),
                                    new TokenReference("primitive.color.brand"),
                                ])],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(declarations).toContainEqual({
            property: "--shadow-primitive-card",
            value: "inset 0px 2px 8px 0px var(--color-primitive-brand), var(--shadow-primitive-soft)",
        });
        expect(declarations).toContainEqual({
            property: "--background-image-primitive-brand",
            value: "linear-gradient(180deg, var(--color-primitive-brand) calc(var(--spacing-primitive-half) * 100%), var(--color-primitive-brand))",
        });
    });

    it("flattens typography and transition aliases into namespace-specific references", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["primitive", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["typography", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["body", new TypographyToken(new TokenReference("semantic.typography.body"))],
                            ]),
                        })],
                        ["transition", new TokenGroup({
                            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                                ["fast", new TransitionToken(new TokenReference("semantic.transition.fast"))],
                            ]),
                        })],
                    ]),
                })],
            ]),
        })));

        expect(declarations).toEqual(expect.arrayContaining([
            { property: "--font-primitive-body", value: "var(--font-semantic-body)" },
            { property: "--text-primitive-body", value: "var(--text-semantic-body)" },
            { property: "--font-weight-primitive-body", value: "var(--font-weight-semantic-body)" },
            { property: "--tracking-primitive-body", value: "var(--tracking-semantic-body)" },
            { property: "--leading-primitive-body", value: "var(--leading-semantic-body)" },
            { property: "--duration-primitive-fast", value: "var(--duration-semantic-fast)" },
            { property: "--ease-primitive-fast", value: "var(--ease-semantic-fast)" },
        ]));
    });

    it("skips unsupported namespaces and invalid typed values", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["border", new BorderToken(new BorderValue(
                    new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"),
                    new DimensionValue(1, "px"),
                    "solid",
                ))],
                ["brokenTypography", new TypographyToken("invalid" as never)],
                ["brokenTransition", new TransitionToken("invalid" as never)],
                ["brokenGradient", new GradientToken([])],
            ]),
        })));

        expect(declarations).toEqual([]);
    });

    it("falls back when a custom tailwind namespace extension is unsupported", () => {
        const declarations = mapper.collectDocument(new Dtcg(new TokenGroup({
            children: new Map<string, TokenGroup | TokenNode<unknown>>([
                ["spacing", new TokenGroup({
                    children: new Map<string, TokenGroup | TokenNode<unknown>>([
                        ["md", new DimensionToken(
                            new DimensionValue(16, "px"),
                            undefined,
                            undefined,
                            { "design-token-kit": { tailwindNamespace: "color" } },
                        )],
                    ]),
                })],
            ]),
        })));

        expect(declarations).toContainEqual({ property: "--spacing-md", value: "16px" });
    });
});
