import { afterEach, describe, expect, it, vi } from "vitest";
import { PluginFigmaFileReader } from "#/figma-plugin/PluginFigmaFileReader";
import { RestFigmaFileReader } from "#/figma-plugin/RestFigmaFileReader";

describe("RestFigmaFileReader", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("rejects an empty access token before making a request", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        await expect(new RestFigmaFileReader("  ", "file-key").read())
            .rejects.toThrow("Enter a Figma access token before exporting REST JSON.");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("trims the access token and returns successful JSON", async () => {
        const payload = { name: "Design file" };
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue(payload),
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(new RestFigmaFileReader("  secret-token  ", "file-key").read()).resolves.toBe(payload);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.figma.com/v1/files/file-key",
            { headers: { "X-Figma-Token": "secret-token" } },
        );
    });

    it("reports non-successful REST responses", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

        await expect(new RestFigmaFileReader("secret-token", "file-key").read())
            .rejects.toThrow("REST export failed: HTTP 403.");
    });
});

describe("PluginFigmaFileReader", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("loads pages one by one when the bulk loading API is unavailable", async () => {
        const events: string[] = [];
        const pages = [
            {
                loadAsync: vi.fn(async () => { events.push("load:one"); }),
                exportAsync: vi.fn(async () => { events.push("export:one"); return pageExport("one"); }),
            },
            {
                loadAsync: vi.fn(async () => { events.push("load:two"); }),
                exportAsync: vi.fn(async () => { events.push("export:two"); return pageExport("two"); }),
            },
        ];
        vi.stubGlobal("figma", {
            root: { id: "0:0", name: "File", children: pages },
        });

        const result = await new PluginFigmaFileReader().read();

        expect(events).toEqual(["load:one", "load:two", "export:one", "export:two"]);
        expect(result).toMatchObject({
            editorType: "figma",
            document: { children: [{ name: "one" }, { name: "two" }] },
            components: {},
            componentSets: {},
            styles: {},
        });
    });

    it("uses defaults for an empty document", async () => {
        vi.stubGlobal("figma", {
            root: { id: "0:0", name: "Empty file", children: [] },
            loadAllPagesAsync: vi.fn(),
        });

        await expect(new PluginFigmaFileReader().read()).resolves.toEqual({
            name: "Empty file",
            lastModified: null,
            thumbnailUrl: null,
            version: null,
            role: null,
            editorType: "figma",
            linkAccess: null,
            document: {
                id: "0:0",
                name: "Empty file",
                type: "DOCUMENT",
                children: [],
            },
            components: {},
            componentSets: {},
            styles: {},
            schemaVersion: 0,
        });
    });

    it("throws when a page export omits its document field", async () => {
        vi.stubGlobal("figma", {
            root: {
                id: "0:0",
                name: "Broken file",
                children: [{ exportAsync: vi.fn().mockResolvedValue({ editorType: "figma" }) }],
            },
            loadAllPagesAsync: vi.fn(),
        });

        await expect(new PluginFigmaFileReader().read())
            .rejects.toThrow('Plugin JSON export is missing required field "document".');
    });
});

function pageExport(name: string): Record<string, unknown> {
    return {
        editorType: "figma",
        document: { id: `${name}:1`, name, type: "CANVAS", children: [] },
    };
}
