import { describe, expect, it } from "vitest";
import { readDtcg, readDtcgList } from "../../support/readDtcg";
import { materializePropertyReferences } from "#/core/model/PropertyReferenceMaterializer";
import { BorderValue } from "#/core/model/values/BorderValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { StrokeStyleToken } from "#/core/model/tokens/StrokeStyleToken";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { ColorValue } from "#/core/model/values/ColorValue";
import { TokenReference } from "#/core/model/TokenReference";

describe("materializePropertyReferences", () => {
    const tokenTypes: Array<[string, unknown]> = [
        ["color", { colorSpace: "srgb", components: [1, 0, 0] }],
        ["dimension", { value: 2, unit: "px" }],
        ["fontFamily", ["Inter", "sans-serif"]],
        ["fontWeight", 500],
        ["number", 1.5],
        ["duration", { value: 120, unit: "ms" }],
        ["cubicBezier", [0.2, 0, 0, 1]],
        ["strokeStyle", "solid"],
        ["border", {
            color: { colorSpace: "srgb", components: [1, 0, 0] },
            width: { value: 1, unit: "px" },
            style: "solid",
        }],
        ["transition", {
            duration: { value: 120, unit: "ms" },
            delay: { value: 0, unit: "ms" },
            timingFunction: [0.2, 0, 0, 1],
        }],
        ["shadow", {
            color: { colorSpace: "srgb", components: [0, 0, 0] },
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
        }],
        ["gradient", [{
            color: { colorSpace: "srgb", components: [1, 0, 0] },
            position: 0,
        }]],
        ["typography", {
            fontFamily: ["Inter", "sans-serif"],
            fontSize: { value: 16, unit: "px" },
            fontWeight: 500,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight: 1.5,
        }],
    ];

    it.each(tokenTypes)("preserves a %s token-level JSON Pointer alias", async (type, value) => {
        const doc = await readDtcg({
            primitive: { target: { $type: type, $value: value } },
            semantic: { copy: { $ref: "#/primitive/target/$value" } },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const copy = semantic.get("copy") as TokenNode<unknown>;

        expect(copy.type).toBe(type);
        expect(copy.value).toBeInstanceOf(TokenReference);
        expect((copy.value as TokenReference).toString()).toBe("{primitive.target}");
    });

    it("resolves color components, component items, alpha, and hex references", async () => {
        const doc = await readDtcg({
            primitive: {
                color: {
                    brand: {
                        $type: "color",
                        $value: {
                            colorSpace: "srgb",
                            components: [0.1, 0.4, 0.9],
                            hex: "#1a66e6",
                        },
                    },
                },
                opacity: { half: { $type: "number", $value: 0.5 } },
            },
            semantic: {
                color: {
                    primary: {
                        $type: "color",
                        $description: "Materialized primary",
                        $value: {
                            colorSpace: { $ref: "#/primitive/color/brand/$value/colorSpace" },
                            components: [
                                { $ref: "#/primitive/color/brand/$value/components/0" },
                                { $ref: "#/primitive/color/brand/$value/components/1" },
                                { $ref: "#/primitive/color/brand/$value/components/2" },
                            ],
                            alpha: { $ref: "#/primitive/opacity/half/$value" },
                            hex: { $ref: "#/primitive/color/brand/$value/hex" },
                        },
                    },
                },
            },
        });

        const materialized = materializePropertyReferences({
            base: doc,
            themes: new Map(),
        });
        const primary = materialized.base.get("semantic")!;
        const colorGroup = (primary as { get(name: string): unknown }).get("color")!;
        const token = (colorGroup as { get(name: string): unknown }).get("primary") as ColorToken;
        const value = token.value as ColorValue;

        expect(value.colorSpace).toBe("srgb");
        expect(value.components).toEqual([0.1, 0.4, 0.9]);
        expect(value.alpha).toBe(0.5);
        expect(value.hex).toBe("#1a66e6");
        expect(token.description).toBe("Materialized primary");
    });

    it("resolves theme references against the theme before the base", async () => {
        const list = await readDtcgList(
            {
                primitive: {
                    color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
                },
                semantic: {
                    color: {
                        primary: {
                            $type: "color",
                            $value: {
                                colorSpace: "srgb",
                                components: { $ref: "#/primitive/color/brand/$value/components" },
                            },
                        },
                    },
                },
            },
            {
                dark: {
                    primitive: {
                        color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1] } } },
                    },
                    semantic: {
                        color: {
                            primary: {
                                $type: "color",
                                $value: {
                                    colorSpace: "srgb",
                                    components: { $ref: "#/primitive/color/brand/$value/components" },
                                },
                            },
                        },
                    },
                },
            },
        );

        const materialized = materializePropertyReferences(list);
        const darkSemantic = materialized.themes.get("dark")!.get("semantic")!;
        const darkColor = (darkSemantic as { get(name: string): unknown }).get("color")!;
        const darkPrimary = (darkColor as { get(name: string): unknown }).get("primary") as ColorToken;

        expect((darkPrimary.value as ColorValue).components).toEqual([0, 0, 1]);
    });

    it("adds a derived theme override when a base property reference depends on a theme token", async () => {
        const list = await readDtcgList(
            {
                primitive: {
                    color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
                },
                semantic: {
                    color: {
                        primary: {
                            $type: "color",
                            $value: {
                                colorSpace: "srgb",
                                components: { $ref: "#/primitive/color/brand/$value/components" },
                            },
                        },
                    },
                },
            },
            {
                dark: {
                    primitive: {
                        color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1] } } },
                    },
                },
            },
        );

        const materialized = materializePropertyReferences(list);
        const dark = materialized.themes.get("dark")!;
        const semantic = dark.get("semantic") as TokenGroup;
        const color = semantic.get("color") as TokenGroup;
        const primary = color.get("primary") as ColorToken;

        expect((primary.value as ColorValue).components).toEqual([0, 0, 1]);
    });

    it("does not add a derived theme token when the referenced value is unchanged", async () => {
        const list = await readDtcgList(
            {
                primitive: {
                    color: { brand: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
                },
                semantic: {
                    color: {
                        primary: {
                            $type: "color",
                            $value: {
                                colorSpace: "srgb",
                                components: { $ref: "#/primitive/color/brand/$value/components" },
                            },
                        },
                    },
                },
            },
            {
                dark: {
                    primitive: {
                        number: { scale: { $type: "number", $value: 2 } },
                    },
                },
            },
        );

        const materialized = materializePropertyReferences(list);
        const dark = materialized.themes.get("dark")!;

        expect(dark.get("semantic")).toBeUndefined();
    });

    it("resolves property references through aliases and nested composite values", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
                dimension: { border: { $type: "dimension", $value: { value: 2, unit: "px" } } },
            },
            aliases: {
                color: { $type: "color", $value: "{primitive.color.red}" },
                dimension: { $type: "dimension", $value: "{primitive.dimension.border}" },
            },
            component: {
                button: {
                    $type: "border",
                    $value: {
                        color: { $ref: "#/aliases/color/$value" },
                        width: { $ref: "#/aliases/dimension/$value" },
                        style: {
                            dashArray: [{ $ref: "#/aliases/dimension/$value" }],
                            lineCap: "round",
                        },
                    },
                },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const button = materialized.base.get("component")!;
        const borderToken = (button as { get(name: string): unknown }).get("button") as BorderToken;
        const border = borderToken.value as BorderValue;

        expect(border.color).toEqual(new ColorValue("srgb", [1, 0, 0]));
        expect(border.width).toEqual(new DimensionValue(2, "px"));
        expect(border.style).toEqual(new StrokeStyleObject([new DimensionValue(2, "px")], "round"));
    });

    it("materializes property references in transition, shadow, gradient, and typography values", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
                dimension: { size: { $type: "dimension", $value: { value: 4, unit: "px" } } },
                duration: { fast: { $type: "duration", $value: { value: 120, unit: "ms" } } },
                easing: { standard: { $type: "cubicBezier", $value: [0.2, 0, 0, 1] } },
                number: { midpoint: { $type: "number", $value: 0.5 } },
                fontFamily: { body: { $type: "fontFamily", $value: ["Inter", "sans-serif"] } },
                fontWeight: { medium: { $type: "fontWeight", $value: 500 } },
            },
            semantic: {
                transition: {
                    standard: {
                        $type: "transition",
                        $value: {
                            duration: { $ref: "#/primitive/duration/fast/$value" },
                            delay: { $ref: "#/primitive/duration/fast/$value" },
                            timingFunction: { $ref: "#/primitive/easing/standard/$value" },
                        },
                    },
                },
                shadow: {
                    card: {
                        $type: "shadow",
                        $value: {
                            color: { $ref: "#/primitive/color/red/$value" },
                            offsetX: { $ref: "#/primitive/dimension/size/$value" },
                            offsetY: { $ref: "#/primitive/dimension/size/$value" },
                            blur: { $ref: "#/primitive/dimension/size/$value" },
                            spread: { $ref: "#/primitive/dimension/size/$value" },
                        },
                    },
                },
                gradient: {
                    brand: {
                        $type: "gradient",
                        $value: [{
                            color: { $ref: "#/primitive/color/red/$value" },
                            position: { $ref: "#/primitive/number/midpoint/$value" },
                        }],
                    },
                },
                typography: {
                    body: {
                        $type: "typography",
                        $value: {
                            fontFamily: { $ref: "#/primitive/fontFamily/body/$value" },
                            fontSize: { $ref: "#/primitive/dimension/size/$value" },
                            fontWeight: { $ref: "#/primitive/fontWeight/medium/$value" },
                            letterSpacing: { $ref: "#/primitive/dimension/size/$value" },
                            lineHeight: { $ref: "#/primitive/number/midpoint/$value" },
                        },
                    },
                },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const transition = (semantic.get("transition") as TokenGroup).get("standard") as TokenNode<unknown>;
        const shadow = (semantic.get("shadow") as TokenGroup).get("card") as TokenNode<unknown>;
        const gradient = (semantic.get("gradient") as TokenGroup).get("brand") as TokenNode<unknown>;
        const typography = (semantic.get("typography") as TokenGroup).get("body") as TokenNode<unknown>;

        expect((transition.value as TransitionValue).duration).toEqual(new DurationValue(120, "ms"));
        expect((transition.value as TransitionValue).timingFunction).toEqual(new CubicBezierValue(0.2, 0, 0, 1));
        expect((shadow.value as ShadowLayer)).toBeInstanceOf(ShadowLayer);
        expect((shadow.value as ShadowLayer).offsetX).toEqual(new DimensionValue(4, "px"));
        expect((gradient.value as GradientStop[])[0]).toBeInstanceOf(GradientStop);
        expect((gradient.value as GradientStop[])[0]?.position).toBe(0.5);
        expect((typography.value as TypographyValue).fontFamily).toEqual(["Inter", "sans-serif"]);
        expect((typography.value as TypographyValue).fontWeight).toBe(500);
    });

    it("materializes references inside dimension and stroke style fields", async () => {
        const doc = await readDtcg({
            primitive: {
                number: { four: { $type: "number", $value: 4 } },
                dimension: {
                    base: { $type: "dimension", $value: { value: 4, unit: "px" } },
                },
                strokeStyle: {
                    base: {
                        $type: "strokeStyle",
                        $value: { dashArray: [{ value: 8, unit: "px" }], lineCap: "round" },
                    },
                },
            },
            semantic: {
                dimension: {
                    copy: {
                        $type: "dimension",
                        $value: {
                            value: { $ref: "#/primitive/number/four/$value" },
                            unit: { $ref: "#/primitive/dimension/base/$value/unit" },
                        },
                    },
                },
                strokeStyle: {
                    copy: {
                        $type: "strokeStyle",
                        $value: {
                            dashArray: { $ref: "#/primitive/strokeStyle/base/$value/dashArray" },
                            lineCap: { $ref: "#/primitive/strokeStyle/base/$value/lineCap" },
                        },
                    },
                },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const dimension = (semantic.get("dimension") as TokenGroup).get("copy") as DimensionToken;
        const stroke = (semantic.get("strokeStyle") as TokenGroup).get("copy") as StrokeStyleToken;

        expect(dimension.value).toEqual(new DimensionValue(4, "px"));
        expect((stroke.value as StrokeStyleObject).dashArray).toEqual([new DimensionValue(8, "px")]);
        expect((stroke.value as StrokeStyleObject).lineCap).toBe("round");
    });

    it("preserves a token-level reference while using the target type", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            },
            semantic: {
                primary: { $ref: "#/primitive/color/red/$value" },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic")!;
        const primary = (semantic as { get(name: string): unknown }).get("primary") as ColorToken;

        expect(primary).toBeInstanceOf(ColorToken);
        expect(primary.value).toBeInstanceOf(TokenReference);
        expect((primary.value as TokenReference).toString()).toBe("{primitive.color.red}");
    });

    it("materializes a token-level pointer to a nested property", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0.4, 0] } } },
            },
            semantic: {
                accent: { $type: "number", $ref: "#/primitive/color/red/$value/components/1" },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const accent = semantic.get("accent") as TokenNode<unknown>;

        expect(accent.value).toBe(0.4);
        expect(accent.type).toBe("number");
    });

    it("infers the type through an untyped alias before resolving a full value pointer", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            },
            aliases: {
                red: { $value: "{primitive.color.red}" },
            },
            semantic: {
                copy: { $value: { $ref: "#/aliases/red/$value" } },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const copy = semantic.get("copy") as ColorToken;

        expect(copy).toBeInstanceOf(ColorToken);
        expect(copy.value).toEqual(new ColorValue("srgb", [1, 0, 0]));
    });

    it("infers the type from a scalar property reference when the token has no type", async () => {
        const doc = await readDtcg({
            primitive: {
                color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0.4, 0] } } },
            },
            semantic: {
                accent: { $value: { $ref: "#/primitive/color/red/$value/components/1" } },
            },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });
        const semantic = materialized.base.get("semantic") as TokenGroup;
        const accent = semantic.get("accent") as TokenNode<unknown>;

        expect(accent).toBeInstanceOf(NumberToken);
        expect(accent.value).toBe(0.4);
    });

    it("returns the original document when no color property references exist", async () => {
        const doc = await readDtcg({
            "$extensions": { "design-token-kit": { remBase: 10 } },
            color: { red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            alias: { $type: "color", $value: "{color.red}" },
        });

        const materialized = materializePropertyReferences({ base: doc, themes: new Map() });

        expect(materialized.base).toBe(doc);
        expect(materialized.base.root.extensions).toEqual({ "design-token-kit": { remBase: 10 } });
        expect(((materialized.base.get("alias") as TokenNode<unknown>).value as TokenReference).value)
            .toBe("color.red");
    });

    it("rejects circular property references", async () => {
        const doc = await readDtcg({
            color: {
                circular: {
                    $type: "color",
                    $value: {
                        colorSpace: "srgb",
                        components: { $ref: "#/color/circular/$value/components" },
                    },
                },
            },
        });

        expect(() => materializePropertyReferences({ base: doc, themes: new Map() }))
            .toThrow("Circular property reference");
    });

    it("rejects a property reference that resolves to an invalid color field", async () => {
        const doc = await readDtcg({
            primitive: {
                invalid: { $type: "number", $value: 0.5 },
            },
            semantic: {
                color: {
                    invalid: {
                        $type: "color",
                        $value: {
                            colorSpace: "srgb",
                            components: { $ref: "#/primitive/invalid/$value" },
                        },
                    },
                },
            },
        });

        expect(() => materializePropertyReferences({ base: doc, themes: new Map() }))
            .toThrow("Color property references must resolve to a complete color value");
    });
});
