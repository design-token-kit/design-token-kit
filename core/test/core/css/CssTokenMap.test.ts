import { describe, expect, it } from "vitest";
import { CssTokenMap } from "#/core/platforms/css/CssTokenMap";
import { TokenPath } from "#/core/model/TokenPath";

describe("CssTokenMap", () => {
    it("writes and restores token metadata", () => {
        const map = new CssTokenMap([{
            customProperty: "--semantic-color-text-primary",
            path: TokenPath.of("semantic", "color", "text", "primary"),
            type: "color",
            description: "Main text color",
            source: "tokens/semantic.dtcg.json",
        }]);

        const restored = CssTokenMap.fromJson(map.toJson());

        expect(restored).toEqual({
            ok: true,
            map: expect.any(CssTokenMap),
        });
        if (!restored.ok) return;

        expect(restored.map.findByCustomProperty("--semantic-color-text-primary")).toEqual({
            customProperty: "--semantic-color-text-primary",
            path: TokenPath.of("semantic", "color", "text", "primary"),
            type: "color",
            description: "Main text color",
            source: "tokens/semantic.dtcg.json",
        });
        expect(restored.map.entries()).toHaveLength(1);
    });

    it.each([
        ["not JSON", "Map is not valid JSON."],
        ['{"version":2,"customProperties":{}}', 'Unsupported map version "2". Expected 1.'],
        ['{"version":1,"customProperties":[]}', "Map customProperties must be a JSON object."],
        ['{"version":1,"customProperties":{"--a":{"path":"","type":"color"}}}', 'Map entry "--a" has an invalid path.'],
        ['{"version":1,"customProperties":{"--a":{"path":"a","type":"unknown"}}}', 'Map entry "--a" has an invalid token type.'],
    ])("rejects %s", (json, reason) => {
        expect(CssTokenMap.fromJson(json)).toEqual({ ok: false, reason });
    });

    it("rejects duplicate custom properties", () => {
        expect(() => new CssTokenMap([
            {
                customProperty: "--color",
                path: TokenPath.of("primitive", "color"),
                type: "color",
                description: undefined,
                source: undefined,
            },
            {
                customProperty: "--color",
                path: TokenPath.of("semantic", "color"),
                type: "color",
                description: undefined,
                source: undefined,
            },
        ])).toThrow('CSS custom property "--color" maps to more than one token.');
    });
});
