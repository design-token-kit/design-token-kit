import { describe, expect, it } from "vitest";
import { isMapUrl, parsePanelPortName, toPanelPortName } from "#/browser-extension/protocol";

describe("panel port name", () => {
    it("round-trips a newly opened panel", () => {
        expect(parsePanelPortName(toPanelPortName({ tabId: 42, reconnect: false })))
            .toEqual({ tabId: 42, reconnect: false });
    });

    it("round-trips a reconnecting panel", () => {
        expect(parsePanelPortName(toPanelPortName({ tabId: 7, reconnect: true })))
            .toEqual({ tabId: 7, reconnect: true });
    });

    it("rejects ports of other senders", () => {
        expect(parsePanelPortName("other:42:opened")).toBeUndefined();
    });

    it("rejects a malformed tab id", () => {
        expect(parsePanelPortName("panel:abc:opened")).toBeUndefined();
    });

    it("rejects an unknown state", () => {
        expect(parsePanelPortName("panel:42:closed")).toBeUndefined();
    });
});

describe("isMapUrl", () => {
    it("accepts absolute http and https URLs", () => {
        expect(isMapUrl("https://example.com/tokens.css.map.json")).toBe(true);
        expect(isMapUrl("http://localhost:3000/map.json")).toBe(true);
    });

    it("rejects other protocols", () => {
        expect(isMapUrl("file:///home/user/map.json")).toBe(false);
        expect(isMapUrl("data:application/json,{}")).toBe(false);
    });

    it("rejects relative and malformed URLs", () => {
        expect(isMapUrl("tokens.css.map.json")).toBe(false);
        expect(isMapUrl("https://")).toBe(false);
    });
});
