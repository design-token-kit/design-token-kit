import { describe, expect, it } from "vitest";
import {
    mapSourceKey,
    mapSourceLabel,
    toStoredMapSource,
    type StoredMapSource,
} from "#/browser-extension/panel/StoredMapSource";

const FILE: StoredMapSource = { kind: "file", name: "tokens.css.map.json", json: "{\"version\":1}" };

const URL_SOURCE: StoredMapSource = { kind: "url", url: "https://example.com/tokens.css.map.json" };

describe("toStoredMapSource", () => {
    it("reads a file source", () => {
        expect(toStoredMapSource({ ...FILE })).toEqual(FILE);
    });

    it("reads a URL source", () => {
        expect(toStoredMapSource({ ...URL_SOURCE })).toEqual(URL_SOURCE);
    });

    it("drops properties of other kinds", () => {
        expect(toStoredMapSource({ ...URL_SOURCE, name: "x.json" })).toEqual(URL_SOURCE);
    });

    it("rejects values that are not objects", () => {
        expect(toStoredMapSource(undefined)).toBeUndefined();
        expect(toStoredMapSource(null)).toBeUndefined();
        expect(toStoredMapSource("https://example.com/map.json")).toBeUndefined();
    });

    it("rejects an unknown kind", () => {
        expect(toStoredMapSource({ kind: "page", url: "https://example.com/map.json" })).toBeUndefined();
    });

    it("rejects a file without a name or content", () => {
        expect(toStoredMapSource({ kind: "file", name: "", json: "{}" })).toBeUndefined();
        expect(toStoredMapSource({ kind: "file", name: "map.json" })).toBeUndefined();
    });

    it("rejects a URL source without a URL", () => {
        expect(toStoredMapSource({ kind: "url", url: "" })).toBeUndefined();
        expect(toStoredMapSource({ kind: "url", url: 42 })).toBeUndefined();
    });
});

describe("mapSourceLabel", () => {
    it("names a file source by its file name", () => {
        expect(mapSourceLabel(FILE)).toBe("tokens.css.map.json");
    });

    it("names a URL source by its URL", () => {
        expect(mapSourceLabel(URL_SOURCE)).toBe("https://example.com/tokens.css.map.json");
    });
});

describe("mapSourceKey", () => {
    it("keys a file source by its content, not its name", () => {
        expect(mapSourceKey({ ...FILE, name: "other.json" })).toBe(mapSourceKey(FILE));
        expect(mapSourceKey({ ...FILE, json: "{}" })).not.toBe(mapSourceKey(FILE));
    });

    it("keys a URL source by its URL", () => {
        expect(mapSourceKey(URL_SOURCE)).toBe(mapSourceKey({ ...URL_SOURCE }));
    });

    it("does not confuse a URL with file content", () => {
        const sameText: StoredMapSource = { kind: "file", name: "map.json", json: URL_SOURCE.url };
        expect(mapSourceKey(sameText)).not.toBe(mapSourceKey(URL_SOURCE));
    });
});
