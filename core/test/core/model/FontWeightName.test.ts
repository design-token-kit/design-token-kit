import { describe, it, expect } from "vitest";
import { FontWeightName } from "#/core/model/values/FontWeightName";

const DTCG_WEIGHTS: Array<[string, number]> = [
    ["thin", 100],
    ["hairline", 100],
    ["extra-light", 200],
    ["ultra-light", 200],
    ["light", 300],
    ["normal", 400],
    ["regular", 400],
    ["book", 400],
    ["medium", 500],
    ["semi-bold", 600],
    ["demi-bold", 600],
    ["bold", 700],
    ["extra-bold", 800],
    ["ultra-bold", 800],
    ["black", 900],
    ["heavy", 900],
    ["extra-black", 950],
    ["ultra-black", 950],
];

describe("FontWeightName", () => {
    it.each(DTCG_WEIGHTS)("maps '%s' to weight %d", (name, weight) => {
        const fontWeight: FontWeightName = FontWeightName.fromName(name);

        expect(fontWeight.name).toBe(name);
        expect(fontWeight.weight).toBe(weight);
    });

    it("returns the same instance for the same name", () => {
        expect(FontWeightName.fromName("regular")).toBe(FontWeightName.REGULAR);
        expect(FontWeightName.fromName("semi-bold")).toBe(FontWeightName.SEMI_BOLD);
    });

    it("finds a font weight by name", () => {
        expect(FontWeightName.find("semi-bold")).toBe(FontWeightName.SEMI_BOLD);
    });

    it("finds nothing for an unknown name or a different case", () => {
        expect(FontWeightName.find("regulr")).toBeUndefined();
        expect(FontWeightName.find("Bold")).toBeUndefined();
    });

    it("lists every DTCG name in specification order", () => {
        expect(FontWeightName.names()).toEqual(DTCG_WEIGHTS.map(([name]) => name));
    });

    it("rejects an unknown name", () => {
        expect(() => FontWeightName.fromName("regulr")).toThrow(/regulr/);
    });

    it("rejects a name in a different case", () => {
        expect(() => FontWeightName.fromName("Bold")).toThrow(/Bold/);
    });
});
