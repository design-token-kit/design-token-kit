import { describe, expect, it, vi } from "vitest";
import { loadUi, type LoadedUi } from "./loadUi";

interface MixpanelEvent {
    event: string;
    properties: Record<string, unknown>;
}

function configureAnalytics(ui: LoadedUi, enabled = true): void {
    ui.receive({
        type: "ANALYTICS_CONFIGURED",
        payload: {
            distinctId: "dtk-test-installation-123456",
            enabled,
            environment: enabled ? "production" : "development",
        },
    });
}

function analyticsEvents(ui: LoadedUi): MixpanelEvent[] {
    return ui.analyticsRequests.map(({ body }) => {
        if (body === undefined) {
            throw new Error("Analytics request did not include a request body.");
        }

        const encodedEvent = new URLSearchParams(body).get("data");
        if (encodedEvent === null) {
            throw new Error("Analytics request did not include Mixpanel data.");
        }

        return JSON.parse(Buffer.from(encodedEvent, "base64").toString("utf8")) as MixpanelEvent;
    });
}

describe("Mixpanel analytics", () => {
    it("sends plugin_opened once after identity configuration", () => {
        const ui = loadUi();

        expect(ui.analyticsRequests).toHaveLength(0);

        configureAnalytics(ui);
        configureAnalytics(ui);

        const events = analyticsEvents(ui);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            event: "plugin_opened",
            properties: {
                distinct_id: "dtk-test-installation-123456",
                analytics_environment: "production",
            },
        });
        ui.close();
    });

    it("sends one export event for one successful token export", () => {
        const ui = loadUi();
        configureAnalytics(ui);
        ui.receive({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [{ fileName: "tokens.json", content: "{}", downloadable: true }],
                warnings: [],
            },
        });

        const exportEvents = analyticsEvents(ui).filter(({ event }) => event === "tokens_exported");
        expect(exportEvents).toHaveLength(1);
        expect(exportEvents[0]?.properties.file_count).toBe(1);
        ui.close();
    });

    it("does not track the automatic startup analysis", () => {
        const ui = loadUi();
        configureAnalytics(ui);
        ui.receive({
            type: "TOKENS_ANALYZED",
            payload: {
                analytics: { totalTokens: 0 },
                architectureChecks: [],
                warnings: [],
            },
        });

        expect(analyticsEvents(ui).map(({ event }) => event)).toEqual(["plugin_opened"]);
        ui.close();
    });

    it("does not send events for a development build", () => {
        const ui = loadUi();
        configureAnalytics(ui, false);
        ui.receive({
            type: "TOKENS_EXPORTED",
            payload: {
                files: [{ fileName: "tokens.json", content: "{}", downloadable: true }],
                warnings: [],
            },
        });

        expect(ui.analyticsRequests).toHaveLength(0);
        ui.close();
    });

    it("keeps export functionality working when Mixpanel rejects a request", () => {
        const rejectedFetch = vi.fn().mockRejectedValue(new Error("analytics unavailable"));
        const ui = loadUi({ fetch: rejectedFetch });

        expect(() => {
            configureAnalytics(ui);
            ui.receive({
                type: "TOKENS_EXPORTED",
                payload: {
                    files: [{ fileName: "tokens.json", content: "{}", downloadable: true }],
                    warnings: [],
                },
            });
        }).not.toThrow();
        expect(rejectedFetch).toHaveBeenCalled();
        expect(ui.get("#export-status").textContent).toBe("Token export started.");
        ui.close();
    });
});
