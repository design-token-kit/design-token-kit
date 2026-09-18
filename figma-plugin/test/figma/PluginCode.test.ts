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
});
