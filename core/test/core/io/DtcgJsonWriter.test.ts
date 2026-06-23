import { describe, it, expect } from "vitest";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgJsonWriter } from "#/core/io/DtcgJsonWriter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

// A small but representative DTCG document: three layers, a couple of token
// types, and an alias - enough to exercise reader <-> writer round-trips.
const SAMPLE = `{
    "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
    "primitive": {
        "color": { "$type": "color", "white": { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } } },
        "dimension": { "$type": "dimension", "space-100": { "$value": { "value": 4, "unit": "px" } } }
    },
    "semantic": {
        "color": { "$type": "color", "background-page": { "$value": "{primitive.color.white}" } }
    },
    "component": {
        "button": { "primary": { "$type": "color", "background": { "$value": "{semantic.color.background-page}" } } }
    }
}`;

function write(doc: Dtcg): Record<string, unknown> {
    return JSON.parse(new DtcgJsonWriter().write(doc)) as Record<string, unknown>;
}

describe("DtcgJsonWriter", () => {
    // Round-trip: reader and writer agree on a representative document.
    describe("round-trip", () => {
        it("produces output readable by DtcgJsonReader", () => {
            const doc = new DtcgJsonReader().parse(SAMPLE);
            const written = new DtcgJsonWriter().write(doc);
            expect(() => new DtcgJsonReader().parse(written)).not.toThrow();
        });

        it("preserves top-level group keys", () => {
            const original = JSON.parse(SAMPLE);
            const written = write(new DtcgJsonReader().parse(SAMPLE));
            const originalKeys = Object.keys(original as object).filter(k => !k.startsWith("$"));
            const writtenKeys = Object.keys(written as object).filter(k => !k.startsWith("$"));
            expect(writtenKeys).toEqual(originalKeys);
        });
    });

    describe("writes $schema", () => {
        it("always writes DTCG schema URI", () => {
            const doc = new Dtcg(new TokenGroup());
            const result = write(doc);
            expect(result["$schema"]).toBe("https://www.designtokens.org/schemas/2025.10/format.json");
        });
    });

    describe("writes token types", () => {
        it("writes color token", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            const root = new TokenGroup({ children: new Map([["red", token]]) });
            const doc = new Dtcg(root);
            const result = write(doc);
            const red = (result["red"] as Record<string, unknown>);
            expect(red["$type"]).toBe("color");
            expect((red["$value"] as Record<string, unknown>)["colorSpace"]).toBe("srgb");
        });

        it("writes color alpha only when not 1", () => {
            const token = new ColorToken(new ColorValue("srgb", [0, 0, 0], 0.5));
            const root = new TokenGroup({ children: new Map([["semi", token]]) });
            const result = write(new Dtcg(root));
            const value = (result["semi"] as Record<string, unknown>)["$value"] as Record<string, unknown>;
            expect(value["alpha"]).toBe(0.5);
        });

        it("omits color alpha when 1", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 1, 1], 1));
            const root = new TokenGroup({ children: new Map([["white", token]]) });
            const result = write(new Dtcg(root));
            const value = (result["white"] as Record<string, unknown>)["$value"] as Record<string, unknown>;
            expect(value).not.toHaveProperty("alpha");
        });

        it("writes dimension token", () => {
            const token = new DimensionToken(new DimensionValue(8, "px"));
            const root = new TokenGroup({ children: new Map([["space", token]]) });
            const result = write(new Dtcg(root));
            const value = (result["space"] as Record<string, unknown>)["$value"] as Record<string, unknown>;
            expect(value["value"]).toBe(8);
            expect(value["unit"]).toBe("px");
        });

        it("writes number token", () => {
            const token = new NumberToken(1.5);
            const root = new TokenGroup({ children: new Map([["ratio", token]]) });
            const result = write(new Dtcg(root));
            const obj = result["ratio"] as Record<string, unknown>;
            expect(obj["$value"]).toBe(1.5);
        });
    });

    describe("writes aliases", () => {
        it("writes token reference as curly-brace string", () => {
            const token = new ColorToken(new TokenReference("primitive.color.white"));
            const root = new TokenGroup({ children: new Map([["bg", token]]) });
            const result = write(new Dtcg(root));
            const obj = result["bg"] as Record<string, unknown>;
            expect(obj["$value"]).toBe("{primitive.color.white}");
        });
    });

    describe("writes groups", () => {
        it("writes nested group structure", () => {
            const token = new NumberToken(42);
            const inner = new TokenGroup({ children: new Map([["val", token]]) });
            const outer = new TokenGroup({ children: new Map([["inner", inner]]) });
            const doc = new Dtcg(outer);
            const result = write(doc);
            const val = ((result["inner"] as Record<string, unknown>)["val"] as Record<string, unknown>);
            expect(val["$value"]).toBe(42);
        });

        it("writes group $type", () => {
            const inner = new TokenGroup({ type: "color" });
            const root = new TokenGroup({ children: new Map([["colors", inner]]) });
            const result = write(new Dtcg(root));
            expect((result["colors"] as Record<string, unknown>)["$type"]).toBe("color");
        });

        it("writes group $description", () => {
            const inner = new TokenGroup({ description: "Brand colors" });
            const root = new TokenGroup({ children: new Map([["brand", inner]]) });
            const result = write(new Dtcg(root));
            expect((result["brand"] as Record<string, unknown>)["$description"]).toBe("Brand colors");
        });

        it("omits undefined group fields", () => {
            const inner = new TokenGroup();
            const root = new TokenGroup({ children: new Map([["empty", inner]]) });
            const result = write(new Dtcg(root));
            const obj = result["empty"] as Record<string, unknown>;
            expect(obj).not.toHaveProperty("$type");
            expect(obj).not.toHaveProperty("$description");
            expect(obj).not.toHaveProperty("$deprecated");
        });
    });

    describe("writes token metadata", () => {
        it("writes $description on token", () => {
            const token = new NumberToken(1, "line height", undefined, undefined);
            const root = new TokenGroup({ children: new Map([["lh", token]]) });
            const result = write(new Dtcg(root));
            expect((result["lh"] as Record<string, unknown>)["$description"]).toBe("line height");
        });

        it("writes $deprecated on token", () => {
            const token = new NumberToken(1, undefined, true, undefined);
            const root = new TokenGroup({ children: new Map([["old", token]]) });
            const result = write(new Dtcg(root));
            expect((result["old"] as Record<string, unknown>)["$deprecated"]).toBe(true);
        });
    });
});
