import { beforeEach, describe, expect, it, vi } from "vitest";

describe("plugin entrypoint", () => {
    const showUI = vi.fn();
    const notify = vi.fn();
    const postMessage = vi.fn();
    const pluginUi: { onmessage?: (message: { type: string; accessToken?: string }) => Promise<void> } = {};

    beforeEach(async () => {
        vi.resetModules();
        showUI.mockReset();
        notify.mockReset();
        postMessage.mockReset();
        pluginUi.onmessage = undefined;
        vi.stubGlobal("__html__", "<main></main>");
        vi.stubGlobal("figma", {
            root: { id: "0:0", name: "My Token File", children: [] },
            currentPage: {
                loadAsync: vi.fn().mockResolvedValue(undefined),
                children: [],
            },
            showUI,
            notify,
            ui: {
                postMessage,
                ...pluginUi,
            },
            variables: {
                getLocalVariablesAsync: vi.fn().mockResolvedValue([]),
            },
            getLocalPaintStylesAsync: vi.fn().mockResolvedValue([]),
        });

        await import("#/figma-plugin/code");
        pluginUi.onmessage = (figma.ui as { onmessage?: typeof pluginUi.onmessage }).onmessage;
    });

    it("initializes the plugin UI", () => {
        expect(showUI).toHaveBeenCalledWith("<main></main>", { width: 800, height: 800 });
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
                architectureChecks: expect.any(Array),
                analytics: expect.objectContaining({ totalTokens: 0 }),
            }),
        }));
    });

    it("audits WCAG contrast on the current page", async () => {
        await pluginUi.onmessage?.({ type: "RUN_WCAG_AUDIT" });

        expect(postMessage).toHaveBeenCalledWith({
            type: "WCAG_AUDITED",
            payload: expect.objectContaining({
                score: null,
                errors: 0,
                warnings: 0,
                nodesChecked: 0,
                findings: [],
            }),
        });
    });
});
