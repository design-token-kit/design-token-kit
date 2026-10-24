import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenArchitectureAnalyzer } from "#/figma-plugin/token-export/TokenArchitectureAnalyzer";
import { TokenExporter } from "#/figma-plugin/token-export/TokenExporter";

describe("TokenExporter", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("exports an empty document when no variable or style source exists", async () => {
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([]),
            },
        });

        await expect(new TokenExporter().export()).resolves.toEqual({
            files: [{
                fileName: "tokens.json",
                content: "{}",
                tokens: {},
                downloadable: false,
                architectureWarnings: [],
            }],
            summary: {
                source: "empty",
                colorTokens: 0,
                dimensionTokens: 0,
                numberTokens: 0,
                typographyTokens: 0,
                shadowTokens: 0,
                skipped: 0,
            },
            warnings: [],
        });
    });

    it("falls back to visible paint styles when Variables API is unavailable", async () => {
        stubFigma({
            getLocalPaintStylesAsync: vi.fn().mockResolvedValue([
                {
                    name: "Brand/Blue",
                    description: "Brand color",
                    paints: [
                        { type: "SOLID", visible: false, color: { r: 1, g: 0, b: 0 } },
                        { type: "SOLID", color: { r: 0, g: 0, b: 1 }, opacity: 0.5 },
                    ],
                },
            ]),
        });

        const result = await new TokenExporter().export();

        expect(result.summary).toMatchObject({ source: "styles", colorTokens: 1 });
        expect(result.warnings).toEqual(["Figma Variables API is unavailable. Falling back to paint styles."]);
        expect(result.files[0]?.tokens).toEqual({
            primitive: {
                color: {
                    brand: {
                        blue: {
                            $type: "color",
                            $value: {
                                colorSpace: "srgb",
                                components: [0, 0, 1],
                                alpha: 0.5,
                            },
                            $description: "Brand color",
                        },
                    },
                },
            },
        });
    });

    it("reports invalid and unsupported paint styles", async () => {
        stubFigma({
            getLocalPaintStylesAsync: vi.fn().mockResolvedValue([
                { name: " / ", description: "", paints: [] },
                { name: "Brand/Gradient", description: "", paints: [{ type: "GRADIENT_LINEAR", visible: true }] },
            ]),
        });

        const result = await new TokenExporter().export();

        expect(result.summary).toMatchObject({ source: "empty", skipped: 2 });
        expect(result.warnings).toEqual([
            "Figma Variables API is unavailable. Falling back to paint styles.",
            'Skipped paint style " / " because it does not contain a valid token path.',
            'Skipped paint style "Brand/Gradient" because it has no visible solid paint.',
        ]);
    });

    it("falls back to paint styles after a Variables API failure", async () => {
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockRejectedValue(new Error("permission denied")),
            },
            getLocalPaintStylesAsync: vi.fn().mockResolvedValue([]),
        });

        const result = await new TokenExporter().export();

        expect(result.warnings).toEqual([
            "Could not read Figma color or float variables: permission denied. Falling back to paint styles.",
        ]);
    });

    it("uses a single export when variable collections cannot be read", async () => {
        const variable = colorVariable("blue", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([variable]),
                getLocalVariableCollectionsAsync: vi.fn().mockRejectedValue("collections unavailable"),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files).toHaveLength(1);
        expect(result.files[0]?.fileName).toBe("tokens.json");
        expect(result.warnings).toContain(
            "Could not read Figma variable collections: collections unavailable. Exporting a single tokens.json file.",
        );
    });

    it("skips variables with invalid paths and unresolved aliases", async () => {
        const invalidPath = colorVariable("invalid", " / ", {
            default: { r: 1, g: 0, b: 0, a: 1 },
        });
        const unresolved = colorVariable("unresolved", "Primitive/Color/Unresolved", {
            default: { type: "VARIABLE_ALIAS", id: "missing" },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([invalidPath, unresolved]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.summary).toMatchObject({ source: "variables", skipped: 2 });
        expect(result.warnings).toEqual(expect.arrayContaining([
            'Skipped color variable " / " because it does not contain a valid token path.',
            'Skipped color variable "Primitive/Color/Unresolved" in tokens.json because it has no raw value or resolvable alias.',
        ]));
    });

    it("exports colors with opacity variable aliases", async () => {
        const baseColor = colorVariable("base-color", "Primitive/Color/White", {
            default: { r: 1, g: 1, b: 1, a: 1 },
        });
        const opacity = floatVariable("opacity", "Primitive/Opacity/Disabled", 0.6, ["OPACITY"]);
        const disabled = colorVariable("disabled", "Primitive/Color/Disabled", {
            default: {
                color: { r: 1, g: 1, b: 1, a: 1 },
                opacity: { type: "VARIABLE_ALIAS", id: "opacity" },
            },
        });
        const disabledAlias = colorVariable("disabled-alias", "Semantic/Color/Disabled", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "base-color" },
                opacity: { type: "VARIABLE_ALIAS", id: "opacity" },
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [baseColor, disabled, disabledAlias] : [opacity]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.warnings).toEqual([]);
        expect(result.files[0]?.tokens).toMatchObject({
            primitive: {
                color: {
                    disabled: {
                        $type: "color",
                        $value: {
                            colorSpace: "srgb",
                            components: [1, 1, 1],
                            alpha: { $ref: "#/primitive/opacity/disabled/$value" },
                        },
                    },
                },
            },
        });
        expect(result.files[0]?.tokens).toMatchObject({
            semantic: {
                color: {
                    disabled: {
                        $value: {
                            colorSpace: { $ref: "#/primitive/color/white/$value/colorSpace" },
                            components: { $ref: "#/primitive/color/white/$value/components" },
                            alpha: { $ref: "#/primitive/opacity/disabled/$value" },
                        },
                    },
                },
            },
        });
    });

    it("preserves adjacent layer aliases instead of flattening the alias chain", async () => {
        const primitive = colorVariable("primitive", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        const semantic = colorVariable("semantic", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "primitive" },
        });
        const component = colorVariable("component", "Component/Card/Default/Background", {
            default: { type: "VARIABLE_ALIAS", id: "semantic" },
        });
        Object.assign(primitive, { variableCollectionId: "primitive-collection" });
        Object.assign(semantic, { variableCollectionId: "semantic-collection" });
        Object.assign(component, { variableCollectionId: "component-collection" });

        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([primitive, semantic, component]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([
                    variableCollection("primitive-collection"),
                    variableCollection("semantic-collection"),
                    variableCollection("component-collection"),
                ]),
            },
        });

        const result = await new TokenExporter().export();
        const report = new TokenArchitectureAnalyzer().analyze(result.files);

        expect(result.files[0]?.tokens).toMatchObject({
            semantic: {
                color: {
                    action: { $value: "{primitive.color.blue}" },
                },
            },
            component: {
                card: {
                    default: {
                        background: { $value: "{semantic.color.action}" },
                    },
                },
            },
        });
        expect(report.warnings).toEqual([]);
    });

    it("references the resolved alias target when the direct target has no token path", async () => {
        const primitive = colorVariable("primitive", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        const unnamed = colorVariable("unnamed", " / ", {
            default: { type: "VARIABLE_ALIAS", id: "primitive" },
        });
        const semantic = colorVariable("semantic", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "unnamed" },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([primitive, unnamed, semantic]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens).toMatchObject({
            semantic: {
                color: {
                    action: { $value: "{primitive.color.blue}" },
                },
            },
        });
    });

    it("references the first exportable alias target behind an unnamed variable", async () => {
        const primitive = colorVariable("primitive", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        const semantic = colorVariable("semantic", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "primitive" },
        });
        const unnamed = colorVariable("unnamed", " / ", {
            default: { type: "VARIABLE_ALIAS", id: "semantic" },
        });
        const opacity = floatVariable("opacity", "Primitive/Opacity/Disabled", 0.6, ["OPACITY"]);
        const background = colorVariable("background", "Component/Card/Background", {
            default: { type: "VARIABLE_ALIAS", id: "unnamed" },
        });
        const disabled = colorVariable("disabled", "Component/Card/Disabled", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "unnamed" },
                opacity: { type: "VARIABLE_ALIAS", id: "opacity" },
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [primitive, semantic, unnamed, background, disabled] : [opacity]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens).toMatchObject({
            component: {
                card: {
                    background: { $value: "{semantic.color.action}" },
                },
            },
        });
        expect(result.files[0]?.referenceSources).toEqual({
            "component.card.disabled": {
                "#/primitive/color/blue/$value/colorSpace": ["semantic", "color", "action"],
                "#/primitive/color/blue/$value/components": ["semantic", "color", "action"],
            },
        });
    });

    it("flattens aliases through variables whose token path is shared or nested", async () => {
        const red = colorVariable("red", "Primitive/Color/Red", {
            default: { r: 1, g: 0, b: 0, a: 1 },
        });
        const blue = colorVariable("blue", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        const action = colorVariable("action", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "red" },
        });
        const duplicateAction = colorVariable("duplicate-action", "semantic/color/action ", {
            default: { type: "VARIABLE_ALIAS", id: "blue" },
        });
        const text = colorVariable("text", "Semantic/Color/Text", {
            default: { type: "VARIABLE_ALIAS", id: "blue" },
        });
        const textPrimary = colorVariable("text-primary", "Semantic/Color/Text/Primary", {
            default: { type: "VARIABLE_ALIAS", id: "red" },
        });
        const background = colorVariable("background", "Component/Button/Background", {
            default: { type: "VARIABLE_ALIAS", id: "action" },
        });
        const label = colorVariable("label", "Component/Button/Label", {
            default: { type: "VARIABLE_ALIAS", id: "text-primary" },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([
                    red, blue, action, duplicateAction, text, textPrimary, background, label,
                ]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens).toMatchObject({
            component: {
                button: {
                    background: { $value: "{primitive.color.red}" },
                    label: { $value: "{primitive.color.red}" },
                },
            },
        });
    });

    it("reports Figma alias targets of flattened opacity color references", async () => {
        const primitiveColor = colorVariable("primitive-color", "Primitive/Color/Blue", {
            default: { r: 0, g: 0, b: 1, a: 1 },
        });
        const primitiveOpacity = floatVariable("primitive-opacity", "Primitive/Opacity/Disabled", 0.6, ["OPACITY"]);
        const semanticColor = colorVariable("semantic-color", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "primitive-color" },
        });
        const semanticOpacity = Object.assign(
            floatVariable("semantic-opacity", "Semantic/Opacity/Disabled", 0, ["OPACITY"]),
            { valuesByMode: { default: { type: "VARIABLE_ALIAS", id: "primitive-opacity" } } },
        );
        const component = colorVariable("component", "Component/Card/Disabled", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "semantic-color" },
                opacity: { type: "VARIABLE_ALIAS", id: "semantic-opacity" },
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR"
                        ? [primitiveColor, semanticColor, component]
                        : [primitiveOpacity, semanticOpacity]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();
        const report = new TokenArchitectureAnalyzer().analyze(result.files);

        expect(result.files[0]?.tokens).toMatchObject({
            component: {
                card: {
                    disabled: {
                        $value: {
                            colorSpace: { $ref: "#/primitive/color/blue/$value/colorSpace" },
                            components: { $ref: "#/primitive/color/blue/$value/components" },
                            alpha: { $ref: "#/primitive/opacity/disabled/$value" },
                        },
                    },
                },
            },
        });
        expect(result.files[0]?.referenceSources).toEqual({
            "component.card.disabled": {
                "#/primitive/color/blue/$value/colorSpace": ["semantic", "color", "action"],
                "#/primitive/color/blue/$value/components": ["semantic", "color", "action"],
                "#/primitive/opacity/disabled/$value": ["semantic", "opacity", "disabled"],
            },
        });
        expect(report.warnings).toEqual([]);
    });

    it("treats an unscoped float alias used as color opacity as a number", async () => {
        const color = colorVariable("color", "Primitive/Color/White", {
            default: { r: 1, g: 1, b: 1, a: 1 },
        });
        const alpha = floatVariable("alpha", "Primitive/Alpha/50", 0.5, []);
        const translucent = colorVariable("translucent", "Semantic/Color/Translucent", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "color" },
                opacity: { type: "VARIABLE_ALIAS", id: "alpha" },
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [color, translucent] : [alpha]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.warnings).toEqual([]);
        expect(result.files[0]?.tokens.semantic).toMatchObject({
            color: {
                translucent: {
                    $value: {
                        alpha: { $ref: "#/primitive/alpha/50/$value" },
                    },
                },
            },
        });
    });

    it("preserves unscoped number variables as number tokens", async () => {
        const number = floatVariable("number", "Primitive/Number/Scale", 1.5, []);
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) => type === "FLOAT" ? [number] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens).toMatchObject({
            primitive: {
                number: {
                    scale: { $type: "number", $value: 1.5 },
                },
            },
        });
    });

    it("preserves opacity substring classification for legacy FLOAT names", async () => {
        const opacity = floatVariable("opacity", "Values/OpacityDisabled", 0.6, []);
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) => type === "FLOAT" ? [opacity] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens).toMatchObject({
            primitive: {
                opacity: {
                    values: {
                        opacitydisabled: { $type: "number", $value: 0.6 },
                    },
                },
            },
        });
    });

    it("skips direct aliases whose color target cannot be exported", async () => {
        const broken = colorVariable("broken", "Primitive/Color/Broken", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "missing" },
                opacity: 0.5,
            },
        });
        const alias = colorVariable("alias", "Semantic/Color/Alias", {
            default: { type: "VARIABLE_ALIAS", id: "broken" },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [broken, alias] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens.primitive).toBeUndefined();
        expect(result.files[0]?.tokens.semantic).toBeUndefined();
    });

    it("skips direct alias cycles", async () => {
        const first = colorVariable("first", "Primitive/Color/First", {
            default: { type: "VARIABLE_ALIAS", id: "second" },
        });
        const second = colorVariable("second", "Primitive/Color/Second", {
            default: { type: "VARIABLE_ALIAS", id: "first" },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [first, second] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens.primitive).toBeUndefined();
        expect(result.warnings).toEqual(expect.arrayContaining([
            'Skipped color variable "Primitive/Color/First" in tokens.json because it has no raw value or resolvable alias.',
            'Skipped color variable "Primitive/Color/Second" in tokens.json because it has no raw value or resolvable alias.',
        ]));
    });

    it("resolves composed color aliases to their final typed targets", async () => {
        const baseColor = colorVariable("base-color", "Primitive/Color/White", {
            default: { r: 1, g: 1, b: 1, a: 1 },
        });
        const aliasedColor = colorVariable("aliased-color", "Primitive/Color/Aliased", {
            default: { type: "VARIABLE_ALIAS", id: "base-color" },
        });
        const composed = colorVariable("composed", "Semantic/Color/Composed", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "aliased-color" },
                opacity: 0.5,
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [baseColor, aliasedColor, composed] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();
        expect(result.files[0]?.tokens).toMatchObject({
            semantic: {
                color: {
                    composed: {
                        $value: {
                            colorSpace: { "$ref": "#/primitive/color/white/$value/colorSpace" },
                            components: { "$ref": "#/primitive/color/white/$value/components" },
                        },
                    },
                },
            },
        });
    });

    it("skips composed color aliases whose composed target is not exportable", async () => {
        const broken = colorVariable("broken", "Primitive/Color/Broken", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "missing" },
                opacity: 0.5,
            },
        });
        const alias = colorVariable("alias", "Semantic/Color/Alias", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "broken" },
                opacity: 0.8,
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [broken, alias] : []),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens.primitive).toBeUndefined();
        expect(result.files[0]?.tokens.semantic).toBeUndefined();
        expect(result.warnings).toEqual(expect.arrayContaining([
            'Skipped color variable "Primitive/Color/Broken" in tokens.json because it has no raw value or resolvable alias.',
            'Skipped color variable "Semantic/Color/Alias" in tokens.json because it has no raw value or resolvable alias.',
        ]));
    });

    it("skips composed colors with a non-number opacity alias", async () => {
        const color = colorVariable("color", "Primitive/Color/White", {
            default: { r: 1, g: 1, b: 1, a: 1 },
        });
        const spacing = floatVariable("spacing", "Primitive/Spacing/4", 4, ["GAP"]);
        const invalid = colorVariable("invalid", "Semantic/Color/Invalid", {
            default: {
                color: { type: "VARIABLE_ALIAS", id: "color" },
                opacity: { type: "VARIABLE_ALIAS", id: "spacing" },
            },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) =>
                    type === "COLOR" ? [color, invalid] : [spacing]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
        });

        const result = await new TokenExporter().export();

        expect(result.files[0]?.tokens.semantic).toBeUndefined();
        expect(result.warnings).toContain(
            'Skipped color variable "Semantic/Color/Invalid" in tokens.json because it has no raw value or resolvable alias.',
        );
    });

    it("exports variables, aliases, and typography into the base file", async () => {
        const blue = colorVariable("blue", "Primitive/Color/Blue", { default: { r: 0, g: 0, b: 1, a: 1 } });
        const action = colorVariable("action", "Semantic/Color/Action", {
            default: { type: "VARIABLE_ALIAS", id: "blue" },
        });
        const spacing = floatVariable("spacing", "Primitive/Spacing/4", 16, ["GAP"]);
        const fontWeight = floatVariable("weight", "Primitive/Font Weight/Regular", 400, ["FONT_WEIGHT"]);

        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) => type === "COLOR" ? [blue, action] : [spacing, fontWeight]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([]),
            },
            getLocalTextStylesAsync: vi.fn().mockResolvedValue([textStyle("Heading/H1", "Semi Bold")]),
        });

        const result = await new TokenExporter().export();

        expect(result.summary).toEqual({
            source: "variables",
            colorTokens: 2,
            dimensionTokens: 1,
            numberTokens: 0,
            typographyTokens: 1,
            shadowTokens: 0,
            skipped: 0,
        });
        expect(result.files[0]?.tokens).toMatchObject({
            primitive: {
                color: { blue: { $value: { components: [0, 0, 1] } } },
                spacing: { 4: { $type: "dimension", $value: { value: 16, unit: "px" } } },
                "font-weight": { regular: { $type: "fontWeight", $value: 400 } },
                typography: { heading: { h1: { $value: { fontWeight: 600 } } } },
            },
            semantic: {
                color: { action: { $value: "{primitive.color.blue}" } },
            },
        });
    });

    it("writes themed variable files and preserves base styles", async () => {
        const variable = colorVariable("canvas", "Primitive/Color/Canvas", {
            light: { r: 1, g: 1, b: 1, a: 1 },
            dark: { r: 0, g: 0, b: 0, a: 1 },
        });
        stubFigma({
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([variable]),
                getLocalVariableCollectionsAsync: vi.fn().mockResolvedValue([{
                    id: "colors",
                    defaultModeId: "light",
                    modes: [{ modeId: "light", name: "Light" }, { modeId: "dark", name: "Dark" }],
                }]),
            },
            getLocalEffectStylesAsync: vi.fn().mockResolvedValue([shadowStyle("Card/Surface")]),
        });

        const result = await new TokenExporter().export();

        expect(result.files.map((file) => file.fileName)).toEqual(["tokens.json", "tokens.dark.json"]);
        expect(result.files[0]?.tokens).toMatchObject({ primitive: { shadow: { card: { surface: { $type: "shadow" } } } } });
        expect(result.files[1]?.tokens).not.toHaveProperty("primitive.shadow");
    });
});

function stubFigma(overrides: Record<string, unknown>): void {
    vi.stubGlobal("figma", {
        getLocalPaintStylesAsync: vi.fn().mockResolvedValue([]),
        ...overrides,
    });
}

function colorVariable(id: string, name: string, valuesByMode: Record<string, unknown>): Record<string, unknown> {
    return {
        id,
        name,
        description: "",
        resolvedType: "COLOR",
        variableCollectionId: "colors",
        valuesByMode,
    };
}

function floatVariable(
    id: string,
    name: string,
    value: number,
    scopes: string[],
): Record<string, unknown> {
    return {
        id,
        name,
        description: "",
        resolvedType: "FLOAT",
        variableCollectionId: "floats",
        valuesByMode: { default: value },
        scopes,
    };
}

function textStyle(name: string, fontStyle: string): Record<string, unknown> {
    return {
        name,
        description: "",
        fontName: { family: "Inter", style: fontStyle },
        fontSize: 24,
        letterSpacing: { unit: "PIXELS", value: 0 },
        lineHeight: { unit: "AUTO", value: 0 },
    };
}

function shadowStyle(name: string): Record<string, unknown> {
    return {
        name,
        description: "",
        effects: [{
            type: "DROP_SHADOW",
            visible: true,
            color: { r: 0, g: 0, b: 0, a: 0.2 },
            offset: { x: 0, y: 2 },
            radius: 4,
        }],
    };
}

function variableCollection(id: string): Record<string, unknown> {
    return {
        id,
        defaultModeId: "default",
        modes: [{ modeId: "default", name: "Default" }],
    };
}
