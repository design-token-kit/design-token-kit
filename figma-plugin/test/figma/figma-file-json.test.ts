import { describe, expect, it, vi } from "vitest";
import { normalizeFileResponse } from "../../src/normalize";
import { PluginFigmaFileReader } from "../../src/PluginFigmaFileReader";
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

describe("message flow", () => {
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
