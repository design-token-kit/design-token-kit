import { beforeEach, describe, expect, it, vi } from "vitest";
import { frame, page, solid, text, textNodes } from "../design-audit/figmaNodes";

describe("plugin entrypoint", () => {
    const showUI = vi.fn();
    const notify = vi.fn();
    const postMessage = vi.fn();
    const pluginUi: { onmessage?: (message: { type: string; [key: string]: unknown }) => Promise<void> } = {};

    beforeEach(async () => {
        vi.resetModules();
        showUI.mockReset();
        notify.mockReset();
        postMessage.mockReset();
        pluginUi.onmessage = undefined;
        vi.stubGlobal("__html__", "<main></main>");
        vi.stubGlobal("figma", {
            root: { id: "0:0", name: "My Token File", children: [] },
            showUI,
            notify,
            ui: {
                postMessage,
                ...pluginUi,
            },
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([]),
                getVariableByIdAsync: vi.fn().mockResolvedValue(null),
                getVariableCollectionByIdAsync: vi.fn().mockResolvedValue(null),
            },
            getLocalPaintStylesAsync: vi.fn().mockResolvedValue([]),
            getLocalTextStylesAsync: vi.fn().mockResolvedValue([]),
        });

        await import("#/figma-plugin/code");
        pluginUi.onmessage = (figma.ui as { onmessage?: typeof pluginUi.onmessage }).onmessage;
    });

    it("initializes the plugin UI", () => {
        expect(showUI).toHaveBeenCalledWith("<main></main>", { width: 720, height: 720 });
        expect(pluginUi.onmessage).toBeTypeOf("function");
    });

    it("notifies when REST export has no file key", async () => {
        await pluginUi.onmessage?.({ type: "EXPORT_REST_JSON", accessToken: "token" });

        expect(notify).toHaveBeenCalledWith(
            "REST export requires figma.fileKey. Reload the plugin after manifest update or run it as a private/local plugin.",
            { error: true },
        );
    });

    it("reports REST export failures through the message handler", async () => {
        (figma as unknown as { fileKey: string }).fileKey = "file-key";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

        await pluginUi.onmessage?.({ type: "EXPORT_REST_JSON", accessToken: "token" });

        expect(notify).toHaveBeenCalledWith("REST export failed: HTTP 403.", { error: true });
        expect(postMessage).toHaveBeenCalledWith({
            type: "EXPORT_FAILED",
            payload: { source: "plugin", message: "REST export failed: HTTP 403." },
        });
    });

    it("exports empty DTCG tokens through the message handler", async () => {
        await pluginUi.onmessage?.({ type: "EXPORT_TOKENS_JSON" });

        expect(postMessage).toHaveBeenCalledWith({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [{ fileName: "tokens.json", content: "{}", tokens: {}, downloadable: false }],
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
            },
        });
    });

    it("converts empty tokens through the CSS export handler", async () => {
        await pluginUi.onmessage?.({ type: "EXPORT_TOKENS_CSS" });

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: "TOKENS_EXPORTED",
            payload: expect.objectContaining({ files: [] }),
        }));
    });

    it.each([
        "EXPORT_TOKENS_DTCG",
        "EXPORT_TOKENS_SCSS",
        "EXPORT_TOKENS_TAILWIND",
        "EXPORT_TOKENS_ANDROID",
        "EXPORT_TOKENS_SWIFTUI",
    ])("handles %s through the token export handler", async (type) => {
        await pluginUi.onmessage?.({ type });

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "TOKENS_EXPORTED" }));
    });

    it("exports plugin JSON through the message handler", async () => {
        (figma.root as unknown as { children: unknown[] }).children = [{
            loadAsync: vi.fn().mockResolvedValue(undefined),
            exportAsync: vi.fn().mockResolvedValue({
                editorType: "figma",
                document: { id: "page", type: "CANVAS", children: [] },
            }),
        }];

        await pluginUi.onmessage?.({ type: "EXPORT_PLUGIN_JSON" });

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: "FILE_EXPORTED",
            payload: expect.objectContaining({
                source: "plugin",
                fileName: "my-token-file.plugin.json",
            }),
        }));
    });

    it("reports plugin JSON export failures to the UI", async () => {
        (figma.root as unknown as { children: unknown[] }).children = [{
            loadAsync: vi.fn().mockResolvedValue(undefined),
            exportAsync: vi.fn().mockRejectedValue(new Error("page export failed")),
        }];

        await pluginUi.onmessage?.({ type: "EXPORT_PLUGIN_JSON" });

        expect(notify).toHaveBeenCalledWith("page export failed", { error: true });
        expect(postMessage).toHaveBeenCalledWith({
            type: "EXPORT_FAILED",
            payload: { source: "plugin", message: "page export failed" },
        });
    });

    it("analyzes exported tokens through the message handler", async () => {
        await pluginUi.onmessage?.({ type: "ANALYZE_TOKENS" });

        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: "TOKENS_ANALYZED",
            payload: expect.objectContaining({
                architectureChecks: [expect.objectContaining({
                    name: "No tokens found",
                    description: "Add local Variables or Styles in Figma to run token checks.",
                    severity: "info",
                    state: "empty",
                })],
                analytics: expect.objectContaining({ totalTokens: 0 }),
            }),
        }));
    });

    it("audits the text of the current page", async () => {
        const root = page("Page", [
            frame("Card", { x: 0, y: 0, width: 200, height: 100 }, [solid("#ffffff")], [
                text("Caption", { x: 20, y: 20, width: 80, height: 20 }, { fills: [solid("#bbbbbb")] }),
            ]),
        ]);
        Object.assign(root, { findAllWithCriteria: () => textNodes(root) });
        Object.assign(figma, { currentPage: root });

        await pluginUi.onmessage?.({ type: "AUDIT_DESIGN", scope: "page" });

        expect(postMessage).toHaveBeenCalledWith({
            type: "DESIGN_AUDITED",
            payload: expect.objectContaining({
                scope: "page",
                nodeCount: 1,
                layerCount: 2,
                coverage: expect.objectContaining({ total: 3, bound: 0, percent: 0 }),
                counts: { errors: 1, warnings: 3, notChecked: 0 },
                scores: {
                    accessibility: { score: 0, grade: "F", evaluated: 1, passed: 0, failed: 1, manualReview: 0, skipped: 0 },
                    tokenUsage: { score: 0, grade: "F", clean: 0, total: 3 },
                },
            }),
        });
    });

    it("loads every page and names the page in each path for a file audit", async () => {
        const box = { x: 0, y: 0, width: 200, height: 100 };
        const pages = ["Home", "Settings"].map((name) => {
            const root = page(name, [frame("Card", box, [solid("#ffffff")], [
                text(`${name} caption`, { x: 20, y: 20, width: 80, height: 20 }, { fills: [solid("#bbbbbb")] }),
            ])]);
            return Object.assign(root, { findAllWithCriteria: () => textNodes(root) });
        });
        const loadAllPagesAsync = vi.fn().mockResolvedValue(undefined);
        Object.assign(figma, { loadAllPagesAsync });
        (figma.root as unknown as { children: PageNode[] }).children = pages;

        await pluginUi.onmessage?.({ type: "AUDIT_DESIGN", scope: "file" });

        expect(loadAllPagesAsync).toHaveBeenCalled();
        const report = postMessage.mock.calls.find(([message]) => message.type === "DESIGN_AUDITED")?.[0].payload;
        expect(report.scope).toBe("file");
        expect(report.nodeCount).toBe(2);
        expect(report.groups[0].nodes.map((node: { path: string }) => node.path)).toEqual(["Home / Card", "Settings / Card"]);
    });

    it("reports design audit failures to the UI", async () => {
        Object.assign(figma, { currentPage: { children: [], findAllWithCriteria: () => { throw new Error("page unavailable"); } } });

        await pluginUi.onmessage?.({ type: "AUDIT_DESIGN" });

        expect(notify).toHaveBeenCalledWith("page unavailable", { error: true });
        expect(postMessage).toHaveBeenCalledWith({ type: "DESIGN_AUDIT_FAILED", payload: { message: "page unavailable" } });
    });

    it("selects audited nodes on their page and brings them into view", async () => {
        const root = page("Other", [frame("Card", { x: 0, y: 0, width: 200, height: 100 }, [solid("#ffffff")])]);
        const card = (root as unknown as { children: SceneNode[] }).children[0];
        const setCurrentPageAsync = vi.fn().mockResolvedValue(undefined);
        const scrollAndZoomIntoView = vi.fn();
        Object.assign(figma, {
            currentPage: { id: "page:Current" },
            getNodeByIdAsync: vi.fn(async (id: string) => (id === card.id ? card : null)),
            setCurrentPageAsync,
            viewport: { scrollAndZoomIntoView },
        });

        await pluginUi.onmessage?.({ type: "SELECT_NODES", ids: [card.id, "missing"] });

        expect(setCurrentPageAsync).toHaveBeenCalledWith(root);
        expect((root as unknown as { selection: SceneNode[] }).selection).toEqual([card]);
        expect(scrollAndZoomIntoView).toHaveBeenCalledWith([card]);
    });

    it("stays on the current page and leaves out nodes of other pages", async () => {
        const box = { x: 0, y: 0, width: 200, height: 100 };
        const current = page("Current", [frame("Card", box, [solid("#ffffff")])]);
        const other = page("Other", [frame("Banner", box, [solid("#ffffff")])]);
        const card = (current as unknown as { children: SceneNode[] }).children[0];
        const banner = (other as unknown as { children: SceneNode[] }).children[0];
        const setCurrentPageAsync = vi.fn();
        const scrollAndZoomIntoView = vi.fn();
        Object.assign(figma, {
            currentPage: current,
            getNodeByIdAsync: vi.fn(async (id: string) => [card, banner, current].find((node) => node.id === id) ?? null),
            setCurrentPageAsync,
            viewport: { scrollAndZoomIntoView },
        });

        await pluginUi.onmessage?.({ type: "SELECT_NODES", ids: [card.id, banner.id, current.id] });

        expect(setCurrentPageAsync).not.toHaveBeenCalled();
        expect((current as unknown as { selection: SceneNode[] }).selection).toEqual([card]);
        expect(scrollAndZoomIntoView).toHaveBeenCalledWith([card]);
    });

    it("tells the user when selected nodes no longer exist", async () => {
        Object.assign(figma, { getNodeByIdAsync: vi.fn().mockResolvedValue(null) });

        await pluginUi.onmessage?.({ type: "SELECT_NODES", ids: ["gone"] });

        expect(notify).toHaveBeenCalledWith("The selected layers no longer exist.");
    });
});
