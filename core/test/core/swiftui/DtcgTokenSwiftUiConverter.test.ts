import { describe, it, expect } from "vitest";
import { readDtcg, readDtcgList } from "../../support/readDtcg";
import {
    SwiftUiTokenConverter,
    type SwiftUiTokenConverterOptions,
} from "#/core/platforms/swiftui/SwiftUiTokenConverter";

async function convert(json: object): Promise<string> {
    const doc = await readDtcg(json);
    return new SwiftUiTokenConverter().convertDocument(doc);
}

async function convertList(
    base: object,
    themes: Record<string, object> = {},
    options?: SwiftUiTokenConverterOptions,
): Promise<string> {
    return new SwiftUiTokenConverter(options).convertList(await readDtcgList(base, themes));
}

describe("SwiftUiTokenConverter scalars", () => {
    it("wraps output in a DesignTokens enum with SwiftUI import", async () => {
        const out = await convert({
            color: {
                base: {
                    red: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [1, 0.2, 0.2] },
                    },
                },
            },
        });
        expect(out).toContain("import SwiftUI");
        expect(out).toContain("enum DesignTokens {");
    });

    it("emits nested enums for groups and static let for tokens", async () => {
        const out = await convert({
            spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
        });
        expect(out).toContain("enum Spacing {");
        expect(out).toContain("static let md: CGFloat = 16");
    });

    it("preserves references as Swift constant paths", async () => {
        const out = await convert({
            color: {
                base: {
                    red: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [1, 0.2, 0.2] },
                    },
                },
                semantic: { primary: { $type: "color", $value: "{color.base.red}" } },
            },
        });
        expect(out).toContain("static let primary = DesignTokens.Color.Base.red");
    });

    it("escapes Swift reserved words in identifiers", async () => {
        const out = await convert({
            color: {
                default: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [0, 0, 0] },
                },
            },
        });
        expect(out).toContain("static let default_ =");
    });

    it("uses a valid identifier for numeric palette steps and keeps a flat alias", async () => {
        const out = await convert({
            primitive: {
                color: {
                    brand: {
                        "500": {
                            $type: "color",
                            $value: { colorSpace: "srgb", components: [0, 0, 1] },
                        },
                    },
                },
            },
            semantic: {
                color: {
                    action: {
                        $type: "color",
                        $value: "{primitive.color.brand.500}",
                    },
                },
            },
        });

        expect(out).toContain("enum Brand {");
        expect(out).toContain("static let _500 = SwiftUI.Color(");
        expect(out).toContain("static let brand500 = Brand._500");
        expect(out).toContain("static let action = DesignTokens.Primitive.Color.Brand._500");
        expect(out).not.toContain("static let 500");
    });

    it("uses valid identifiers in numeric token groups and references", async () => {
        const out = await convert({
            primitive: {
                spacing: {
                    "4": {
                        md: {
                            $type: "dimension",
                            $value: { value: 16, unit: "px" },
                        },
                    },
                },
            },
            semantic: {
                spacing: {
                    md: {
                        $type: "dimension",
                        $value: "{primitive.spacing.4.md}",
                    },
                },
            },
        });

        expect(out).toContain("enum _4 {");
        expect(out).toContain("static let md: CGFloat = 16");
        expect(out).toContain("static let md = DesignTokens.Primitive.Spacing._4.md");
        expect(out).not.toContain("enum 4 {");
    });

    it("does not generate a palette alias that conflicts with an existing token", async () => {
        const out = await convert({
            primitive: {
                color: {
                    brand: {
                        "500": {
                            $type: "color",
                            $value: { colorSpace: "srgb", components: [0, 0, 1] },
                        },
                    },
                    brand500: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [1, 0, 0] },
                    },
                },
            },
        });

        expect(out).toContain("static let brand500 = SwiftUI.Color(");
        expect(out).not.toContain("static let brand500 = Brand._500");
    });

    it("limits flat compatibility aliases to color palette steps", async () => {
        const out = await convert({
            primitive: {
                spacing: {
                    scale: {
                        "500": {
                            $type: "dimension",
                            $value: { value: 16, unit: "px" },
                        },
                    },
                },
            },
        });

        expect(out).toContain("static let _500: CGFloat = 16");
        expect(out).not.toContain("static let scale500");
    });

    it("emits /// doc comment from a token $description", async () => {
        const out = await convert({
            color: {
                $description: "Full color palette.",
                white: {
                    $type: "color",
                    $description: "Pure white for backgrounds.",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
            },
        });
        expect(out).toContain("/// Full color palette.");
        expect(out).toContain("/// Pure white for backgrounds.");
    });

    it("emits /// doc comment from a group $description", async () => {
        const out = await convert({
            primitive: {
                $description: "Raw design values.",
                color: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
            },
        });
        expect(out).toContain("/// Raw design values.");
    });

    it("handles multi-line descriptions", async () => {
        const out = await convert({
            color: {
                $description: "Full color palette.\nIncludes brand, status, and neutral colors.",
                white: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
            },
        });
        expect(out).toContain("/// Full color palette.\n    /// Includes brand, status, and neutral colors.");
    });

    it("does not emit /// when description is absent", async () => {
        const out = await convert({
            color: {
                white: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 1, 1] },
                },
            },
        });
        expect(out).not.toContain("/// Pure white");
    });

    it("emits auto-generated file header", async () => {
        const out = await convert({});
        expect(out).toMatch(/^\/\/ Auto-generated by design-token-kit\. DO NOT EDIT\.\n/);
    });

    it("returns an empty DesignTokens enum for empty input", async () => {
        const out = await convert({});
        expect(out).toContain("enum DesignTokens {");
        const body = out.slice(out.indexOf("enum DesignTokens {"));
        expect(body).not.toContain("static let");
    });
});

describe("SwiftUiTokenConverter composites", () => {
    it("emits a ShadowToken struct and value when a shadow token exists", async () => {
        const out = await convert({
            elevation: {
                low: {
                    $type: "shadow",
                    $value: {
                        color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 },
                        offsetX: { value: 0, unit: "px" },
                        offsetY: { value: 2, unit: "px" },
                        blur: { value: 4, unit: "px" },
                        spread: { value: 0, unit: "px" },
                    },
                },
            },
        });
        expect(out).toContain("struct ShadowToken {");
        expect(out).toContain("static let low: [ShadowToken] = [ShadowToken(");
    });

    it("renders a multi-layer shadow as an array of ShadowToken", async () => {
        const out = await convert({
            elevation: {
                high: {
                    $type: "shadow",
                    $value: [
                        { color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.2 }, offsetX: { value: 0, unit: "px" }, offsetY: { value: 1, unit: "px" }, blur: { value: 2, unit: "px" }, spread: { value: 0, unit: "px" } },
                        { color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.1 }, offsetX: { value: 0, unit: "px" }, offsetY: { value: 4, unit: "px" }, blur: { value: 8, unit: "px" }, spread: { value: 0, unit: "px" } },
                    ],
                },
            },
        });
        expect(out).toContain("static let high: [ShadowToken] = [");
        expect(out.match(/ShadowToken\(/g)?.length).toBe(2);
    });

    it("preserves a strokeStyle object in the generated wrapper", async () => {
        const out = await convert({
            stroke: {
                dashed: {
                    $type: "strokeStyle",
                    $value: { dashArray: [{ value: 2, unit: "px" }, { value: 2, unit: "px" }], lineCap: "butt" },
                },
            },
        });
        expect(out).toContain("StrokeStyleToken(dashed: true, dashArray: [2, 2], lineCap: .butt, keyword: nil)");
        expect(out).toContain("let dashArray: [CGFloat]");
        expect(out).toContain("let lineCap: StrokeLineCap?");
    });

    it("does not emit composite structs when no composite tokens exist", async () => {
        const out = await convert({
            spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
        });
        expect(out).not.toContain("struct ShadowToken");
        expect(out).not.toContain("struct TypographyToken");
    });

    it("emits a TypographyToken struct and value", async () => {
        const out = await convert({
            text: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: 400,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });
        expect(out).toContain("struct TypographyToken {");
        expect(out).toContain("static let body = TypographyToken(");
        expect(out).toContain("fontFamily: FontFamilyToken([\"Inter\"])");
        expect(out).toContain("fontSize: 16");
        expect(out).toContain("fontWeight: FontWeightToken(Int(400))");
        expect(out).toContain("letterSpacing: 0");
        expect(out).toContain("lineHeight: 1.5");
    });

    it("preserves transition delay and timing function", async () => {
        const out = await convert({
            motion: {
                enter: {
                    $type: "transition",
                    $value: {
                        duration: { value: 200, unit: "ms" },
                        delay: { value: 50, unit: "ms" },
                        timingFunction: [0.2, 0, 0.8, 1],
                    },
                },
            },
        });

        expect(out).toContain("struct TransitionToken {");
        expect(out).toContain("let delay: TimeInterval");
        expect(out).toContain("let timingFunction: SwiftUI.UnitCurve");
        expect(out).toContain("TransitionToken(duration: 0.2, delay: 0.05, timingFunction: SwiftUI.UnitCurve.bezier");
    });

    it("qualifies SwiftUI types so a group named 'color' does not shadow SwiftUI.Color", async () => {
        const out = await convert({
            color: {
                brand: {
                    $type: "color",
                    $value: { colorSpace: "srgb", components: [1, 0, 0] },
                },
            },
        });
        expect(out).toContain("enum Color {");
        expect(out).toContain("SwiftUI.Color(");
        expect(out).not.toMatch(/= Color\(/);
    });

    it("routes a strokeStyle keyword through StrokeStyleToken", async () => {
        const dashed = await convert({
            stroke: { a: { $type: "strokeStyle", $value: "dashed" } },
        });
        expect(dashed).toContain("StrokeStyleToken(dashed: true, dashArray: [], lineCap: nil, keyword: \"dashed\")");

        const solid = await convert({
            stroke: { b: { $type: "strokeStyle", $value: "solid" } },
        });
        expect(solid).toContain("StrokeStyleToken(dashed: false, dashArray: [], lineCap: nil, keyword: \"solid\")");
    });

    it("preserves a strokeStyle reference instead of flattening it", async () => {
        const out = await convert({
            stroke: {
                base: { $type: "strokeStyle", $value: "dashed" },
                alias: { $type: "strokeStyle", $value: "{stroke.base}" },
            },
        });
        expect(out).toContain("static let alias = DesignTokens.Stroke.base");
        expect(out).not.toContain("static let alias = StrokeStyleToken(dashed");
    });

    it("uses SwiftUI.Font.custom when typography has a concrete fontFamily", async () => {
        const out = await convert({
            text: {
                heading: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: { value: 24, unit: "px" },
                        fontWeight: 700,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.2,
                    },
                },
            },
        });
        expect(out).toContain("SwiftUI.Font.custom(");
        expect(out).toContain(".weight(.bold)");
    });

    it("preserves string font families and keyword font weights", async () => {
        const out = await convert({
            text: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: "semi-bold",
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });

        expect(out).toContain("fontFamily: FontFamilyToken(\"Inter\")");
        expect(out).toContain("fontWeight: FontWeightToken(\"semi-bold\")");
        expect(out).toContain("SwiftUI.Font.custom(\"Inter\", size: 16).weight(.semibold)");
    });

    it("preserves references for transition fields", async () => {
        const out = await convert({
            duration: {
                fast: { $type: "duration", $value: { value: 200, unit: "ms" } },
                pause: { $type: "duration", $value: { value: 50, unit: "ms" } },
            },
            cubicBezier: {
                standard: { $type: "cubicBezier", $value: [0.2, 0, 0.8, 1] },
            },
            motion: {
                enter: {
                    $type: "transition",
                    $value: {
                        duration: "{duration.fast}",
                        delay: "{duration.pause}",
                        timingFunction: "{cubicBezier.standard}",
                    },
                },
            },
        });

        expect(out).toContain(
            "TransitionToken(duration: DesignTokens.Duration.fast, delay: DesignTokens.Duration.pause, timingFunction: DesignTokens.Cubicbezier.standard)",
        );
    });

    it("emits composite wrappers in the struct-based output", async () => {
        const out = await convertList(
            {
                motion: {
                    enter: {
                        $type: "transition",
                        $value: {
                            duration: { value: 200, unit: "ms" },
                            delay: { value: 50, unit: "ms" },
                            timingFunction: [0.2, 0, 0.8, 1],
                        },
                    },
                },
            },
            {},
            { swiftType: "struct" },
        );

        expect(out).toContain("struct Theme {");
        expect(out).toContain("let enter: TransitionToken");
        expect(out).toContain("static let base = Theme(");
    });

    it("uses a system font when typography only references its font family", async () => {
        const out = await convert({
            text: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "{font.family.body}",
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: 700,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });

        expect(out).toContain("SwiftUI.Font.system(size: 16, weight: .bold)");
    });

    it("renders gradient stop references without flattening them", async () => {
        const out = await convert({
            color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            gradient: { brand: { $type: "gradient", $value: ["{color.primary}"] } },
        });

        expect(out).toContain("SwiftUI.Gradient.Stop(color: DesignTokens.Color.primary, location: 0)");
    });

    it("emits a standalone fontFamily list token as a [String] literal", async () => {
        const out = await convert({
            font: {
                family: {
                    body: { $type: "fontFamily", $value: ["Inter", "Arial", "sans-serif"] },
                },
            },
        });
        expect(out).toContain(`["Inter", "Arial", "sans-serif"]`);
        expect(out).toMatch(/static let body/);
    });

    it("preserves a reference to a fontFamily list token", async () => {
        const out = await convert({
            font: {
                family: {
                    body: { $type: "fontFamily", $value: ["Inter", "Arial", "sans-serif"] },
                },
            },
            text: {
                "family-body": { $type: "fontFamily", $value: "{font.family.body}" },
            },
        });
        expect(out).toContain("static let familyBody = DesignTokens.Font.Family.body");
    });
});

const THEMED_BASE = {
    primitive: {
        color: {
            background: { $type: "color", $value: { colorSpace: "srgb", components: [1, 1, 1] } },
            text: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0] } },
        },
    },
    semantic: {
        color: {
            surface: { $type: "color", $value: "{primitive.color.background}" },
        },
    },
};

const DARK_OVERRIDE = {
    primitive: {
        color: {
            background: { $type: "color", $value: { colorSpace: "srgb", components: [0.1, 0.1, 0.1] } },
        },
    },
};

describe("SwiftUiTokenConverter enum themes", () => {
    it("emits a base enum and a full per-theme enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE });
        expect(out).toContain("enum DesignTokens {");
        expect(out).toContain("enum DesignTokensDark {");
        expect((out.match(/import SwiftUI/g) ?? []).length).toBe(1);
    });

    it("renders an overridden token as a value in the theme enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE });
        expect(out).toContain("SwiftUI.Color(.sRGB, red: 0.1, green: 0.1, blue: 0.1");
    });

    it("renders a non-overridden token as a reference to the base enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE });
        expect(out).toContain("static let text = DesignTokens.Primitive.Color.text");
    });

    it("roots an intra-theme reference at the theme's own namespace", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE });
        expect(out).toContain("static let surface = DesignTokensDark.Primitive.Color.background");
    });

    it("keeps base semantic references rooted at the base enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE });
        expect(out).toContain("static let surface = DesignTokens.Primitive.Color.background");
    });

    it("pascalizes a multi-word theme name in the enum name", async () => {
        const out = await convertList(THEMED_BASE, { "high-contrast": DARK_OVERRIDE });
        expect(out).toContain("enum DesignTokensHighContrast {");
        expect(out).toContain("static let surface = DesignTokensHighContrast.Primitive.Color.background");
    });

    it("keeps flat palette aliases in theme enums", async () => {
        const base = {
            primitive: {
                color: {
                    brand: {
                        "500": {
                            $type: "color",
                            $value: { colorSpace: "srgb", components: [0, 0, 1] },
                        },
                    },
                },
            },
        };
        const dark = {
            primitive: {
                color: {
                    brand: {
                        "500": {
                            $type: "color",
                            $value: { colorSpace: "srgb", components: [1, 1, 1] },
                        },
                    },
                },
            },
        };

        const out = await convertList(base, { dark });

        expect(out.match(/static let brand500 = Brand\._500/g)).toHaveLength(2);
    });

    it("produces unchanged single-doc output when there are no themes", async () => {
        const viaList = await convertList(THEMED_BASE);
        const viaDoc = await convert(THEMED_BASE);
        expect(viaList).toBe(viaDoc);
        expect(viaList).not.toContain("DesignTokensDark");
        expect(viaList).not.toContain("struct Theme");
    });
});

describe("SwiftUiTokenConverter struct themes", () => {
    it("keeps flat palette aliases in the Theme struct", async () => {
        const out = await convertList({
            primitive: {
                color: {
                    brand: {
                        "500": {
                            $type: "color",
                            $value: { colorSpace: "srgb", components: [0, 0, 1] },
                        },
                    },
                },
            },
        }, {}, { swiftType: "struct" });

        expect(out).toContain("let _500: SwiftUI.Color");
        expect(out).toContain("var brand500: SwiftUI.Color { brand._500 }");
        expect(out).toContain("static let brand500 = Brand._500");
    });

    it("emits a Theme struct mirroring the token tree", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE }, { swiftType: "struct" });
        expect(out).toContain("struct Theme {");
        expect(out).toContain("let surface: SwiftUI.Color");
    });

    it("emits the enum layer alongside the struct layer", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE }, { swiftType: "struct" });
        expect(out).toContain("enum DesignTokens {");
        expect(out).toContain("enum DesignTokensDark {");
    });

    it("emits a base instance referencing the base enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE }, { swiftType: "struct" });
        expect(out).toContain("static let base = Theme(");
        expect(out).toContain("DesignTokens.Semantic.Color.surface");
    });

    it("emits a theme instance referencing the theme enum", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE }, { swiftType: "struct" });
        expect(out).toContain("static let dark = Theme(");
        expect(out).toContain("DesignTokensDark.Semantic.Color.surface");
    });

    it("holds enum references in struct fields, not color literals", async () => {
        const out = await convertList(THEMED_BASE, { dark: DARK_OVERRIDE }, { swiftType: "struct" });
        const themesSection = out.slice(out.indexOf("enum Themes {"));
        expect(themesSection).not.toContain("SwiftUI.Color(");
    });

    it("emits a single default instance in the degenerate no-themes struct", async () => {
        const out = await convertList(THEMED_BASE, {}, { swiftType: "struct" });
        expect(out).toContain("struct Theme {");
        expect(out).toContain("static let base = Theme(");
        expect(out).toContain("DesignTokens.Semantic.Color.surface");
        expect(out).not.toContain("DesignTokensDark");
    });
});

describe("SwiftUiTokenConverter rem dimensions", () => {
    const REM_TOKENS = {
        space: {
            $type: "dimension",
            md: { $value: { value: 1.5, unit: "rem" } },
            px: { $value: { value: 24, unit: "px" } },
        },
    };

    it("expands rem against the default base", async () => {
        const out = await convert(REM_TOKENS);
        expect(out).toContain("static let md: CGFloat = 24");
    });

    it("emits px unchanged", async () => {
        const out = await convert(REM_TOKENS);
        expect(out).toContain("static let px: CGFloat = 24");
    });

    it("renders equal magnitudes identically regardless of unit", async () => {
        const out = await convert(REM_TOKENS);
        expect(out).toContain("static let md: CGFloat = 24");
        expect(out).toContain("static let px: CGFloat = 24");
    });

    it("expands rem in typography fontSize", async () => {
        const out = await convert({
            typography: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: { value: 1, unit: "rem" },
                        fontWeight: 400,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });
        expect(out).toContain('SwiftUI.Font.custom("Inter", size: 16)');
    });

    it("expands rem in typography letterSpacing", async () => {
        const out = await convert({
            typography: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: 400,
                        letterSpacing: { value: 0.5, unit: "rem" },
                        lineHeight: 1.5,
                    },
                },
            },
        });
        expect(out).toContain("tracking: 8");
    });

    it("expands rem in shadow blur and offsets", async () => {
        const out = await convert({
            shadow: {
                soft: {
                    $type: "shadow",
                    $value: {
                        color: { colorSpace: "srgb", components: [0, 0, 0] },
                        offsetX: { value: 0.25, unit: "rem" },
                        offsetY: { value: 0.5, unit: "rem" },
                        blur: { value: 1, unit: "rem" },
                        spread: { value: 0, unit: "px" },
                    },
                },
            },
        });
        expect(out).toContain("radius: 16");
        expect(out).toContain("x: 4");
        expect(out).toContain("y: 8");
    });

    it("expands rem in border width", async () => {
        const out = await convert({
            border: {
                thin: {
                    $type: "border",
                    $value: {
                        color: { colorSpace: "srgb", components: [0, 0, 0] },
                        width: { value: 0.125, unit: "rem" },
                        style: "solid",
                    },
                },
            },
        });
        expect(out).toContain("width: 2");
    });

    it("uses the rem base declared by the document", async () => {
        const out = await convert({ ...REM_TOKENS, $extensions: { "design-token-kit": { remBase: 10 } } });
        expect(out).toContain("static let md: CGFloat = 15");
    });

    it("prefers the explicit option over the declared base", async () => {
        const out = await convertList(
            { ...REM_TOKENS, $extensions: { "design-token-kit": { remBase: 10 } } },
            {},
            { remBase: 16 },
        );
        expect(out).toContain("static let md: CGFloat = 24");
    });

    it("falls back to the default base when the declared one is unusable", async () => {
        const out = await convert({ ...REM_TOKENS, $extensions: { "design-token-kit": { remBase: "sixteen" } } });
        expect(out).toContain("static let md: CGFloat = 24");
    });

    it("formats fractional results without a long tail", async () => {
        const out = await convert({
            space: { xs: { $type: "dimension", $value: { value: 0.1, unit: "rem" } } },
        });
        expect(out).toContain("static let xs: CGFloat = 1.6");
    });
});
