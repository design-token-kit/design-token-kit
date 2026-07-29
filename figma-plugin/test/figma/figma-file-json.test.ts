import { describe, expect, it, vi } from "vitest";
import { normalizeFileResponse } from "../../src/normalize";
import { PluginFigmaFileReader } from "../../src/PluginFigmaFileReader";
import { mapFigmaColorTokenName } from "../../src/tokens/FigmaTokenNameMapper";
import { loadPluginContext, toPlainJson } from "./loadPluginContext";

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

describe("mapFigmaColorTokenName", () => {
    it("keeps explicit primitive, semantic and component token layers", () => {
        expect(mapFigmaColorTokenName("Primitive/Color/Blue/500")?.path).toEqual(["primitive", "color", "blue", "500"]);
        expect(mapFigmaColorTokenName("Semantic/Color/Action/Primary")?.path).toEqual(["semantic", "color", "action", "primary"]);
        expect(mapFigmaColorTokenName("Component/Button/Primary/Bg")?.path).toEqual(["component", "button", "primary", "bg"]);
    });

    it("falls back to primitive color path when layer is omitted", () => {
        expect(mapFigmaColorTokenName("Blue/500")?.path).toEqual(["primitive", "color", "blue", "500"]);
    });

    it("normalizes whitespace and special characters", () => {
        expect(mapFigmaColorTokenName(" Primitive / Color / Brand Blue / 500 % ")?.path).toEqual(["primitive", "color", "brand-blue", "500"]);
    });

    it("rejects empty names and incomplete explicit layer paths", () => {
        expect(mapFigmaColorTokenName("  / / ")).toBeUndefined();
        expect(mapFigmaColorTokenName("Primitive")).toBeUndefined();
        expect(mapFigmaColorTokenName("Semantic/Color")).toBeUndefined();
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
                            name: "Primitive/Color/Blue/500",
                            description: "Primary blue",
                            valuesByMode: {
                                default: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                            },
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
                        },
                    ],
                    summary: {
                        source: "variables",
                        colorTokens: 1,
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
                            name: "Primitive/Color/Blue/500",
                            description: "",
                            valuesByMode: {
                                default: { r: 0.145, g: 0.388, b: 0.922, a: 1 },
                            },
                        },
                        {
                            id: "variable-action-primary",
                            name: "Semantic/Color/Action/Primary",
                            description: "Primary action color",
                            valuesByMode: {
                                default: { type: "VARIABLE_ALIAS", id: "variable-blue-500" },
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
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 2,
                    skipped: 0,
                },
                warnings: [],
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
                            name: "Semantic/Color/Action/Primary",
                            description: "",
                            valuesByMode: {
                                default: { type: "VARIABLE_ALIAS", id: "missing-variable" },
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
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    skipped: 1,
                },
                warnings: [
                    "Skipped color variable \"Semantic/Color/Action/Primary\" because it has no raw color value or resolvable alias.",
                ],
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
                    },
                ],
                summary: {
                    source: "styles",
                    colorTokens: 1,
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
                    },
                ],
                summary: {
                    source: "variables",
                    colorTokens: 0,
                    skipped: 1,
                },
                warnings: [
                    "Skipped color variable \"Primitive\" because it does not contain a valid token path.",
                ],
            },
        });
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
