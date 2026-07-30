import { describe, expect, it, vi } from "vitest";
import { normalizeFileResponse } from "#/figma-plugin/normalize";
import { PluginFigmaFileReader } from "#/figma-plugin/PluginFigmaFileReader";
import { mapColorTokenName, mapTokenName } from "#/figma-plugin/token-export/TokenNameMapper";
import { loadPluginContext, toPlainJson } from "./loadPluginContext";

interface TokenExportPayload {
    files: Array<{
        fileName: string;
        content: string;
        downloadable: boolean;
        tokens?: unknown;
    }>;
}

describe("normalizeFileResponse", () => {
    it("normalizes REST-like and Plugin-like file responses to the same DTO", () => {
        const restLike = {
            name: "Sample File",
            document: {
                id: "0:0",
                name: "Sample File",
                type: "DOCUMENT",
                children: [
                    {
                        id: "1:1",
                        name: "Page 1",
                        type: "CANVAS",
                        children: [
                            {
                                id: "2:1",
                                name: "Frame",
                                type: "FRAME",
                                children: [],
                            },
                        ],
                    },
                ],
            },
            components: {
                "10:1": {},
            },
            componentSets: {
                "11:1": {},
            },
            styles: {
                "12:1": {},
            },
        };

        const pluginLike = {
            name: "Sample File",
            lastModified: null,
            thumbnailUrl: null,
            version: null,
            role: null,
            editorType: "figma",
            linkAccess: null,
            document: restLike.document,
            components: restLike.components,
            componentSets: restLike.componentSets,
            styles: restLike.styles,
            schemaVersion: 0,
        };

        const restDto = toPlainJson(normalizeFileResponse(restLike));
        const pluginDto = toPlainJson(normalizeFileResponse(pluginLike));

        expect(pluginDto).toEqual(restDto);
        expect(restDto).toEqual({
            name: "Sample File",
            pages: [
                {
                    id: "1:1",
                    name: "Page 1",
                    type: "CANVAS",
                    children: [
                        {
                            id: "2:1",
                            name: "Frame",
                            type: "FRAME",
                            children: [],
                        },
                    ],
                },
            ],
            componentIds: ["10:1"],
            componentSetIds: ["11:1"],
            styleIds: ["12:1"],
        });
    });
});

describe("PluginFigmaFileReader", () => {
    it("exports whole-document plugin JSON from all pages and merges metadata buckets", async () => {
        const pageOneExport = {
            editorType: "figma",
            document: {
                id: "1:1",
                name: "Page 1",
                type: "CANVAS",
                children: [],
            },
            components: {
                "10:1": { key: "component-a" },
            },
            componentSets: {
                "20:1": { key: "set-a" },
            },
            styles: {
                "30:1": { key: "style-a" },
            },
        };
        const pageTwoExport = {
            editorType: "figma",
            document: {
                id: "2:1",
                name: "Page 2",
                type: "CANVAS",
                children: [],
            },
            components: {
                "10:2": { key: "component-b" },
            },
            componentSets: {},
            styles: {
                "30:2": { key: "style-b" },
            },
        };

        vi.stubGlobal("figma", {
            root: {
                id: "0:0",
                name: "Sample File",
                children: [
                    { exportAsync: async () => pageOneExport },
                    { exportAsync: async () => pageTwoExport },
                ],
            },
            loadAllPagesAsync: async () => {},
        });

        const reader = new PluginFigmaFileReader();
        const result = toPlainJson(await reader.read());

        expect(result).toEqual({
            name: "Sample File",
            lastModified: null,
            thumbnailUrl: null,
            version: null,
            role: null,
            editorType: "figma",
            linkAccess: null,
            document: {
                id: "0:0",
                name: "Sample File",
                type: "DOCUMENT",
                children: [
                    pageOneExport.document,
                    pageTwoExport.document,
                ],
            },
            components: {
                "10:1": { key: "component-a" },
                "10:2": { key: "component-b" },
            },
            componentSets: {
                "20:1": { key: "set-a" },
            },
            styles: {
                "30:1": { key: "style-a" },
                "30:2": { key: "style-b" },
            },
            schemaVersion: 0,
        });

        vi.unstubAllGlobals();
    });
});

describe("mapColorTokenName", () => {
    it("keeps explicit primitive, semantic and component token layers", () => {
        expect(mapColorTokenName("Primitive/Color/Blue/500")?.path).toEqual(["primitive", "color", "blue", "500"]);
        expect(mapColorTokenName("Semantic/Color/Action/Primary")?.path).toEqual(["semantic", "color", "action", "primary"]);
        expect(mapColorTokenName("Component/Button/Primary/Bg")?.path).toEqual(["component", "button", "primary", "bg"]);
    });

    it("falls back to primitive color path when layer is omitted", () => {
        expect(mapColorTokenName("Blue/500")?.path).toEqual(["primitive", "color", "blue", "500"]);
    });

    it("normalizes whitespace and special characters", () => {
        expect(mapColorTokenName(" Primitive / Color / Brand Blue / 500 % ")?.path).toEqual(["primitive", "color", "brand-blue", "500"]);
    });

    it("rejects empty names and incomplete explicit layer paths", () => {
        expect(mapColorTokenName("  / / ")).toBeUndefined();
        expect(mapColorTokenName("Primitive")).toBeUndefined();
        expect(mapColorTokenName("Semantic/Color")).toBeUndefined();
    });
});

describe("mapTokenName", () => {
    it("uses the requested fallback path when layer is omitted", () => {
        expect(mapTokenName("4", ["primitive", "spacing"])?.path).toEqual(["primitive", "spacing", "4"]);
        expect(mapTokenName("Disabled", ["primitive", "opacity"])?.path).toEqual(["primitive", "opacity", "disabled"]);
    });
});

describe("message flow", () => {
    it("posts a tokens export payload from color variables", async () => {
        const context = loadPluginContext({
            figma: {
                root: {
                    id: "0:0",
                    name: "Token File",
                    children: [],
                },
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            id: "variable-blue-500",
                            variableCollectionId: "collection-colors",
                            name: "Primitive/Color/Blue/500",
                            description: "Primary blue",
                            valuesByMode: {
                                default: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                            },
                        },
                    ],
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-colors",
                            defaultModeId: "default",
                            modes: [{ modeId: "default", name: "Default" }],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages)).toEqual([
            {
                type: "TOKENS_EXPORTED",
                payload: {
                    files: [
                        {
                            fileName: "tokens.json",
                            content: JSON.stringify({
                                primitive: {
                                    color: {
                                        blue: {
                                            500: {
                                                $type: "color",
                                                $value: {
                                                    colorSpace: "srgb",
                                                    components: [0.145, 0.388, 0.922],
                                                    alpha: 1,
                                                },
                                                $description: "Primary blue",
                                            },
                                        },
                                    },
                                },
                            }, null, 2),
                            tokens: {
                                primitive: {
                                    color: {
                                        blue: {
                                            500: {
                                                $type: "color",
                                                $value: {
                                                    colorSpace: "srgb",
                                                    components: [0.145, 0.388, 0.922],
                                                    alpha: 1,
                                                },
                                                $description: "Primary blue",
                                            },
                                        },
                                    },
                                },
                            },
                            downloadable: true,
                        },
                    ],
                    summary: {
                        source: "variables",
                        colorTokens: 1,
                        dimensionTokens: 0,
                        numberTokens: 0,
                        typographyTokens: 0,
                        shadowTokens: 0,
                        skipped: 0,
                    },
                    warnings: [],
                },
            },
        ]);
    });

    it("exports color variable aliases as DTCG references", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            id: "variable-blue-500",
                            variableCollectionId: "collection-colors",
                            name: "Primitive/Color/Blue/500",
                            description: "",
                            valuesByMode: {
                                default: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                            },
                        },
                        {
                            id: "variable-action-primary",
                            variableCollectionId: "collection-colors",
                            name: "Semantic/Color/Action/Primary",
                            description: "Primary action color",
                            valuesByMode: {
                                default: { type: "VARIABLE_ALIAS", id: "variable-blue-500" },
                            },
                        },
                    ],
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-colors",
                            defaultModeId: "default",
                            modes: [{ modeId: "default", name: "Default" }],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                color: {
                                    blue: {
                                        500: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.145, 0.388, 0.922],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                            semantic: {
                                color: {
                                    action: {
                                        primary: {
                                            $type: "color",
                                            $value: "{primitive.color.blue.500}",
                                            $description: "Primary action color",
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                color: {
                                    blue: {
                                        500: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.145, 0.388, 0.922],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                            semantic: {
                                color: {
                                    action: {
                                        primary: {
                                            $type: "color",
                                            $value: "{primitive.color.blue.500}",
                                            $description: "Primary action color",
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 2,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("exports float variables as dimension and number tokens", async () => {
        const variables = [
            {
                id: "variable-spacing-4",
                variableCollectionId: "collection-size",
                name: "Primitive/Spacing/4",
                description: "Base spacing",
                resolvedType: "FLOAT",
                scopes: ["GAP"],
                valuesByMode: {
                    default: 16,
                },
            },
            {
                id: "variable-opacity-disabled",
                variableCollectionId: "collection-size",
                name: "Primitive/Opacity/Disabled",
                description: "",
                resolvedType: "FLOAT",
                scopes: ["OPACITY"],
                valuesByMode: {
                    default: 0.4,
                },
            },
            {
                id: "variable-spacing-md",
                variableCollectionId: "collection-size",
                name: "Semantic/Spacing/Md",
                description: "",
                resolvedType: "FLOAT",
                scopes: ["GAP"],
                valuesByMode: {
                    default: { type: "VARIABLE_ALIAS", id: "variable-spacing-4" },
                },
            },
        ];
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async (type: string) => variables.filter((variable) => variable.resolvedType === type),
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-size",
                            defaultModeId: "default",
                            modes: [{ modeId: "default", name: "Default" }],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                spacing: {
                                    4: {
                                        $type: "dimension",
                                        $value: { value: 16, unit: "px" },
                                        $description: "Base spacing",
                                    },
                                },
                                opacity: {
                                    disabled: {
                                        $type: "number",
                                        $value: 0.4,
                                    },
                                },
                            },
                            semantic: {
                                spacing: {
                                    md: {
                                        $type: "dimension",
                                        $value: "{primitive.spacing.4}",
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                spacing: {
                                    4: {
                                        $type: "dimension",
                                        $value: { value: 16, unit: "px" },
                                        $description: "Base spacing",
                                    },
                                },
                                opacity: {
                                    disabled: {
                                        $type: "number",
                                        $value: 0.4,
                                    },
                                },
                            },
                            semantic: {
                                spacing: {
                                    md: {
                                        $type: "dimension",
                                        $value: "{primitive.spacing.4}",
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    dimensionTokens: 2,
                    numberTokens: 1,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("exports float variable mode overrides", async () => {
        const variables = [
            {
                id: "variable-radius-md",
                variableCollectionId: "collection-size",
                name: "Primitive/Radius/Md",
                description: "",
                resolvedType: "FLOAT",
                scopes: ["CORNER_RADIUS"],
                valuesByMode: {
                    compact: 8,
                    spacious: 12,
                },
            },
        ];
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async (type: string) => variables.filter((variable) => variable.resolvedType === type),
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-size",
                            defaultModeId: "compact",
                            modes: [
                                { modeId: "compact", name: "Compact" },
                                { modeId: "spacious", name: "Spacious" },
                            ],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                radius: {
                                    md: {
                                        $type: "dimension",
                                        $value: { value: 8, unit: "px" },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                radius: {
                                    md: {
                                        $type: "dimension",
                                        $value: { value: 8, unit: "px" },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                    {
                        fileName: "tokens.spacious.json",
                        content: JSON.stringify({
                            primitive: {
                                radius: {
                                    md: {
                                        $type: "dimension",
                                        $value: { value: 12, unit: "px" },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                radius: {
                                    md: {
                                        $type: "dimension",
                                        $value: { value: 12, unit: "px" },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    dimensionTokens: 2,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("exports local text styles as typography tokens", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [],
                },
                getLocalPaintStylesAsync: async () => [],
                getLocalTextStylesAsync: async () => [
                    {
                        name: "Heading/H1",
                        description: "Main heading",
                        fontName: { family: "Inter", style: "Semi Bold" },
                        fontSize: 32,
                        lineHeight: { unit: "PIXELS", value: 40 },
                        letterSpacing: { unit: "PERCENT", value: -2 },
                    },
                ],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            component: {
                                typography: {
                                    heading: {
                                        h1: {
                                            $type: "typography",
                                            $value: {
                                                fontFamily: "Inter",
                                                fontSize: { value: 32, unit: "px" },
                                                fontWeight: 600,
                                                letterSpacing: { value: -0.64, unit: "px" },
                                                lineHeight: 1.25,
                                            },
                                            $description: "Main heading",
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            component: {
                                typography: {
                                    heading: {
                                        h1: {
                                            $type: "typography",
                                            $value: {
                                                fontFamily: "Inter",
                                                fontSize: { value: 32, unit: "px" },
                                                fontWeight: 600,
                                                letterSpacing: { value: -0.64, unit: "px" },
                                                lineHeight: 1.25,
                                            },
                                            $description: "Main heading",
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "styles",
                    colorTokens: 0,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 1,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("exports local effect styles as shadow tokens", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [],
                },
                getLocalPaintStylesAsync: async () => [],
                getLocalTextStylesAsync: async () => [],
                getLocalEffectStylesAsync: async () => [
                    {
                        name: "Card/Shadow",
                        description: "Card elevation",
                        effects: [
                            {
                                type: "DROP_SHADOW",
                                color: { r: 0, g: 0, b: 0, a: 0.2 },
                                offset: { x: 0, y: 8 },
                                radius: 24,
                                spread: -2,
                                visible: true,
                            },
                        ],
                    },
                ],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            component: {
                                shadow: {
                                    card: {
                                        shadow: {
                                            $type: "shadow",
                                            $value: {
                                                color: {
                                                    colorSpace: "srgb",
                                                    components: [0, 0, 0],
                                                    alpha: 0.2,
                                                },
                                                offsetX: { value: 0, unit: "px" },
                                                offsetY: { value: 8, unit: "px" },
                                                blur: { value: 24, unit: "px" },
                                                spread: { value: -2, unit: "px" },
                                            },
                                            $description: "Card elevation",
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            component: {
                                shadow: {
                                    card: {
                                        shadow: {
                                            $type: "shadow",
                                            $value: {
                                                color: {
                                                    colorSpace: "srgb",
                                                    components: [0, 0, 0],
                                                    alpha: 0.2,
                                                },
                                                offsetX: { value: 0, unit: "px" },
                                                offsetY: { value: 8, unit: "px" },
                                                blur: { value: 24, unit: "px" },
                                                spread: { value: -2, unit: "px" },
                                            },
                                            $description: "Card elevation",
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "styles",
                    colorTokens: 0,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 1,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("exports inner shadow layers and warns about unsupported effects", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [],
                },
                getLocalPaintStylesAsync: async () => [],
                getLocalTextStylesAsync: async () => [],
                getLocalEffectStylesAsync: async () => [
                    {
                        name: "Input/Shadow",
                        description: "",
                        effects: [
                            {
                                type: "INNER_SHADOW",
                                color: { r: 1, g: 1, b: 1, a: 0.6 },
                                offset: { x: 0, y: 1 },
                                radius: 2,
                                visible: true,
                            },
                            {
                                type: "LAYER_BLUR",
                                radius: 4,
                                visible: true,
                            },
                        ],
                    },
                ],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            component: {
                                shadow: {
                                    input: {
                                        shadow: {
                                            $type: "shadow",
                                            $value: {
                                                color: {
                                                    colorSpace: "srgb",
                                                    components: [1, 1, 1],
                                                    alpha: 0.6,
                                                },
                                                offsetX: { value: 0, unit: "px" },
                                                offsetY: { value: 1, unit: "px" },
                                                blur: { value: 2, unit: "px" },
                                                spread: { value: 0, unit: "px" },
                                                inset: true,
                                            },
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            component: {
                                shadow: {
                                    input: {
                                        shadow: {
                                            $type: "shadow",
                                            $value: {
                                                color: {
                                                    colorSpace: "srgb",
                                                    components: [1, 1, 1],
                                                    alpha: 0.6,
                                                },
                                                offsetX: { value: 0, unit: "px" },
                                                offsetY: { value: 1, unit: "px" },
                                                blur: { value: 2, unit: "px" },
                                                spread: { value: 0, unit: "px" },
                                                inset: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "styles",
                    colorTokens: 0,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 1,
                    skipped: 1,
                },
                warnings: [
                    "Skipped unsupported non-shadow effects in effect style \"Input/Shadow\".",
                ],
            },
        });
    });

    it("skips color variable aliases when the target cannot be mapped", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            id: "variable-action-primary",
                            variableCollectionId: "collection-colors",
                            name: "Semantic/Color/Action/Primary",
                            description: "",
                            valuesByMode: {
                                default: { type: "VARIABLE_ALIAS", id: "missing-variable" },
                            },
                        },
                    ],
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-colors",
                            defaultModeId: "default",
                            modes: [{ modeId: "default", name: "Default" }],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({}, null, 2),
                        tokens: {},
                        downloadable: false,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 1,
                },
                warnings: [
                    "Skipped color variable \"Semantic/Color/Action/Primary\" in tokens.json because it has no raw value or resolvable alias.",
                ],
            },
        });
    });

    it("exports default and theme files from variable modes", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            id: "variable-bg-canvas",
                            variableCollectionId: "collection-theme",
                            name: "Primitive/Color/Bg/Canvas",
                            description: "",
                            valuesByMode: {
                                light: { r: 1, g: 1, b: 1, a: 1 },
                                dark: { r: 0.05, g: 0.05, b: 0.05, a: 1 },
                            },
                        },
                    ],
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-theme",
                            defaultModeId: "light",
                            modes: [
                                { modeId: "light", name: "Light" },
                                { modeId: "dark", name: "Dark" },
                            ],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                color: {
                                    bg: {
                                        canvas: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [1, 1, 1],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                color: {
                                    bg: {
                                        canvas: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [1, 1, 1],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                    {
                        fileName: "tokens.dark.json",
                        content: JSON.stringify({
                            primitive: {
                                color: {
                                    bg: {
                                        canvas: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.05, 0.05, 0.05],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                color: {
                                    bg: {
                                        canvas: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.05, 0.05, 0.05],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 2,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("does not warn when a non-default mode has no override", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            id: "variable-blue-500",
                            variableCollectionId: "collection-theme",
                            name: "Primitive/Color/Blue/500",
                            description: "",
                            valuesByMode: {
                                light: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                            },
                        },
                    ],
                    getLocalVariableCollectionsAsync: async () => [
                        {
                            id: "collection-theme",
                            defaultModeId: "light",
                            modes: [
                                { modeId: "light", name: "Light" },
                                { modeId: "dark", name: "Dark" },
                            ],
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                color: {
                                    blue: {
                                        500: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.145, 0.388, 0.922],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                color: {
                                    blue: {
                                        500: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.145, 0.388, 0.922],
                                                alpha: 1,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 1,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("falls back to paint styles when there are no color variables", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [],
                },
                getLocalPaintStylesAsync: async () => [
                    {
                        name: "Red/600",
                        description: "",
                        paints: [
                            {
                                type: "SOLID",
                                color: { r: 0.86, g: 0.15, b: 0.15 },
                                opacity: 0.9,
                            },
                        ],
                    },
                ],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({
                            primitive: {
                                color: {
                                    red: {
                                        600: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.86, 0.15, 0.15],
                                                alpha: 0.9,
                                            },
                                        },
                                    },
                                },
                            },
                        }, null, 2),
                        tokens: {
                            primitive: {
                                color: {
                                    red: {
                                        600: {
                                            $type: "color",
                                            $value: {
                                                colorSpace: "srgb",
                                                components: [0.86, 0.15, 0.15],
                                                alpha: 0.9,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        downloadable: true,
                    },
                ],
                summary: {
                    source: "styles",
                    colorTokens: 1,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 0,
                },
                warnings: [],
            },
        });
    });

    it("skips color variables with invalid token names", async () => {
        const context = loadPluginContext({
            figma: {
                variables: {
                    getLocalVariablesAsync: async () => [
                        {
                            name: "Primitive",
                            description: "",
                            valuesByMode: {
                                default: { r: 1, g: 0, b: 0, a: 1 },
                            },
                        },
                    ],
                },
                getLocalPaintStylesAsync: async () => [],
            },
        });

        await context.sendMessage({ type: "EXPORT_TOKENS_JSON" });

        expect(toPlainJson(context.postedMessages[0])).toEqual({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [
                    {
                        fileName: "tokens.json",
                        content: JSON.stringify({}, null, 2),
                        tokens: {},
                        downloadable: false,
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    dimensionTokens: 0,
                    numberTokens: 0,
                    typographyTokens: 0,
                    shadowTokens: 0,
                    skipped: 1,
                },
                warnings: [
                    "Skipped color variable \"Primitive\" because it does not contain a valid token path.",
                ],
            },
        });
    });

    it("converts exported tokens to CSS through core", async () => {
        const context = loadSingleColorTokenContext();

        await context.sendMessage({ type: "EXPORT_TOKENS_CSS" });

        const payload = getTokenExportPayload(context.postedMessages[0]);
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0].fileName).toBe("tokens.css");
        expect(payload.files[0].content).toContain(":root");
        expect(payload.files[0].content).toContain("--primitive-color-blue-500");
    });

    it("converts exported token modes to SCSS files through core", async () => {
        const context = loadColorModeTokenContext();

        await context.sendMessage({ type: "EXPORT_TOKENS_SCSS" });

        const payload = getTokenExportPayload(context.postedMessages[0]);
        expect(payload.files.map((file) => file.fileName)).toEqual([
            "tokens.scss",
            "tokens.dark.scss",
        ]);
        expect(payload.files[0].content).toContain("$primitive-color-bg-canvas");
        expect(payload.files[1].content).toContain("$primitive-color-bg-canvas");
    });

    it("converts exported tokens to Tailwind v4 through core", async () => {
        const context = loadSingleColorTokenContext();

        await context.sendMessage({ type: "EXPORT_TOKENS_TAILWIND" });

        const payload = getTokenExportPayload(context.postedMessages[0]);
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0].fileName).toBe("tokens.tailwind.css");
        expect(payload.files[0].content).toContain("@import 'tailwindcss';");
        expect(payload.files[0].content).toContain("@theme");
    });

    it("converts exported tokens to SwiftUI through core", async () => {
        const context = loadSingleColorTokenContext();

        await context.sendMessage({ type: "EXPORT_TOKENS_SWIFTUI" });

        const payload = getTokenExportPayload(context.postedMessages[0]);
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0].fileName).toBe("DesignTokens.swift");
        expect(payload.files[0].content).toContain("import SwiftUI");
        expect(payload.files[0].content).toContain("enum DesignTokens");
    });

    it("posts a plugin export payload through the plugin message flow", async () => {
        const pageExport = {
            editorType: "figma",
            document: {
                id: "1:1",
                name: "Page 1",
                type: "CANVAS",
                children: [],
            },
            components: {},
            componentSets: {},
            styles: {},
        };

        const context = loadPluginContext({
            figma: {
                root: {
                    id: "0:0",
                    name: "Sample File",
                    children: [{ exportAsync: async () => pageExport }],
                },
                loadAllPagesAsync: async () => {},
            },
        });

        await context.sendMessage({ type: "EXPORT_PLUGIN_JSON" });

        expect(toPlainJson(context.postedMessages)).toEqual([
            {
                type: "FILE_EXPORTED",
                payload: {
                    source: "plugin",
                    fileName: "sample-file.plugin.json",
                    content: JSON.stringify({
                        name: "Sample File",
                        lastModified: null,
                        thumbnailUrl: null,
                        version: null,
                        role: null,
                        editorType: "figma",
                        linkAccess: null,
                        document: {
                            id: "0:0",
                            name: "Sample File",
                            type: "DOCUMENT",
                            children: [pageExport.document],
                        },
                        components: {},
                        componentSets: {},
                        styles: {},
                        schemaVersion: 0,
                    }, null, 2),
                    dto: {
                        name: "Sample File",
                        pages: [
                            {
                                id: "1:1",
                                name: "Page 1",
                                type: "CANVAS",
                                children: [],
                            },
                        ],
                        componentIds: [],
                        componentSetIds: [],
                        styleIds: [],
                    },
                },
            },
        ]);
    });

    it("posts a rest export payload through the plugin message flow", async () => {
        const restLike = {
            name: "Remote File",
            document: {
                id: "0:0",
                name: "Remote File",
                type: "DOCUMENT",
                children: [],
            },
            components: { "10:1": {} },
            componentSets: {},
            styles: { "12:1": {} },
        };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => restLike,
        });
        const context = loadPluginContext({
            fetch: fetchMock as unknown as typeof globalThis.fetch,
            figma: {
                root: {
                    id: "0:0",
                    name: "Remote File",
                    children: [],
                },
                fileKey: "remote-file-key",
            },
        });

        await context.sendMessage({ type: "EXPORT_REST_JSON", accessToken: "figd_token" });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.figma.com/v1/files/remote-file-key",
            {
                headers: {
                    "X-Figma-Token": "figd_token",
                },
            },
        );
        expect(toPlainJson(context.postedMessages)).toEqual([
            {
                type: "FILE_EXPORTED",
                payload: {
                    source: "rest",
                    fileName: "remote-file.rest.json",
                    content: JSON.stringify(restLike, null, 2),
                    dto: {
                        name: "Remote File",
                        pages: [],
                        componentIds: ["10:1"],
                        componentSetIds: [],
                        styleIds: ["12:1"],
                    },
                },
            },
        ]);
    });
});

function loadSingleColorTokenContext(): ReturnType<typeof loadPluginContext> {
    return loadPluginContext({
        figma: {
            variables: {
                getLocalVariablesAsync: async () => [
                    {
                        id: "variable-blue-500",
                        variableCollectionId: "collection-colors",
                        name: "Primitive/Color/Blue/500",
                        description: "",
                        valuesByMode: {
                            default: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                        },
                    },
                ],
                getLocalVariableCollectionsAsync: async () => [
                    {
                        id: "collection-colors",
                        defaultModeId: "default",
                        modes: [{ modeId: "default", name: "Default" }],
                    },
                ],
            },
            getLocalPaintStylesAsync: async () => [],
        },
    });
}

function getTokenExportPayload(message: { type: string; payload: unknown } | undefined): TokenExportPayload {
    expect(message?.type).toBe("TOKENS_EXPORTED");
    return toPlainJson(message?.payload) as TokenExportPayload;
}

function loadColorModeTokenContext(): ReturnType<typeof loadPluginContext> {
    return loadPluginContext({
        figma: {
            variables: {
                getLocalVariablesAsync: async () => [
                    {
                        id: "variable-bg-canvas",
                        variableCollectionId: "collection-theme",
                        name: "Primitive/Color/Bg/Canvas",
                        description: "",
                        valuesByMode: {
                            light: { r: 1, g: 1, b: 1, a: 1 },
                            dark: { r: 0.05, g: 0.05, b: 0.05, a: 1 },
                        },
                    },
                ],
                getLocalVariableCollectionsAsync: async () => [
                    {
                        id: "collection-theme",
                        defaultModeId: "light",
                        modes: [
                            { modeId: "light", name: "Light" },
                            { modeId: "dark", name: "Dark" },
                        ],
                    },
                ],
            },
            getLocalPaintStylesAsync: async () => [],
        },
    });
}
