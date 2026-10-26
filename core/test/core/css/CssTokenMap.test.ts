import { describe, expect, it } from "vitest";
import { CssTokenMap, type CssTokenMapEntry } from "#/core/platforms/css/CssTokenMap";
import { TokenPath } from "#/core/model/TokenPath";

const textEntry: CssTokenMapEntry = {
    customProperty: "--semantic-color-text-primary",
    path: TokenPath.parse("semantic.color.text.primary"),
    type: "color",
    description: "Main text color",
    source: "tokens/semantic.dtcg.json",
};

const spacingEntry: CssTokenMapEntry = {
    customProperty: "--primitive-spacing-4",
    path: TokenPath.parse("primitive.spacing.4"),
    type: undefined,
    description: undefined,
    source: undefined,
};

describe("CssTokenMap", () => {
    it("finds an entry by custom property", () => {
        const map = new CssTokenMap([textEntry, spacingEntry]);
        expect(map.findByCustomProperty("--semantic-color-text-primary")).toBe(textEntry);
        expect(map.findByCustomProperty("--unknown")).toBeUndefined();
    });

    it("keeps entries in the given order", () => {
        expect(new CssTokenMap([spacingEntry, textEntry]).entries()).toEqual([spacingEntry, textEntry]);
    });

    it("rejects two entries for one custom property", () => {
        expect(() => new CssTokenMap([textEntry, textEntry])).toThrow("--semantic-color-text-primary");
    });

    it("writes the versioned JSON representation", () => {
        const json: unknown = JSON.parse(new CssTokenMap([textEntry, spacingEntry]).toJson());
        expect(json).toEqual({
            version: 1,
            customProperties: {
                "--semantic-color-text-primary": {
                    path: "semantic.color.text.primary",
                    type: "color",
                    description: "Main text color",
                    source: "tokens/semantic.dtcg.json",
                },
                "--primitive-spacing-4": { path: "primitive.spacing.4" },
            },
        });
    });

    it("restores the map it wrote", () => {
        const result = CssTokenMap.fromJson(new CssTokenMap([textEntry, spacingEntry]).toJson());
        if (!result.ok) throw new Error(result.reason);
        const restored = result.map.findByCustomProperty("--semantic-color-text-primary");
        expect(restored?.path.toString()).toBe("semantic.color.text.primary");
        expect(restored?.type).toBe("color");
        expect(restored?.description).toBe("Main text color");
        expect(restored?.source).toBe("tokens/semantic.dtcg.json");
        expect(result.map.entries()).toHaveLength(2);
    });

    it.each([
        ["not json", "Malformed JSON"],
        ["[]", "Expected a JSON object"],
        [JSON.stringify({ version: 2, customProperties: {} }), "Unsupported version 2"],
        [JSON.stringify({ version: 1 }), "\"customProperties\""],
        [JSON.stringify({ version: 1, customProperties: { "x": { path: "a" } } }), "must start with \"--\""],
        [JSON.stringify({ version: 1, customProperties: { "--x": "a" } }), "expected an object"],
        [JSON.stringify({ version: 1, customProperties: { "--x": { path: "" } } }), "\"path\""],
        [JSON.stringify({ version: 1, customProperties: { "--x": { path: "a", type: "colour" } } }), "\"type\""],
        [JSON.stringify({ version: 1, customProperties: { "--x": { path: "a", type: null } } }), "\"type\""],
        [JSON.stringify({ version: 1, customProperties: { "--x": { path: "a", description: 1 } } }), "\"description\""],
        [
            JSON.stringify({ version: 1, customProperties: { "--x": { path: "a", description: null } } }),
            "\"description\"",
        ],
        [JSON.stringify({ version: 1, customProperties: { "--x": { path: "a", source: 1 } } }), "\"source\""],
    ])("rejects %s", (json, reason) => {
        const result = CssTokenMap.fromJson(json);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain(reason);
    });
});
