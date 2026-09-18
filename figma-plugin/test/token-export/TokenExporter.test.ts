import { afterEach, describe, expect, it, vi } from "vitest";
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
