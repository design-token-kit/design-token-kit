import { describe, it, expect } from "vitest";
import { HrdtTokenReader, HrdtTokenReaderError } from "#/core/io/HrdtTokenReader";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

function parse(yaml: string): Dtcg {
    return new HrdtTokenReader().parse(yaml);
}

function getGroup(doc: Dtcg, ...path: string[]): TokenGroup {
    let node: ReturnType<Dtcg["get"]> = doc.get(path[0]);
    for (const key of path.slice(1)) {
        node = (node as TokenGroup).get(key);
    }
    return node as TokenGroup;
}

describe("HrdtTokenReader", () => {
    describe("document structure", () => {
        it("parses top-level groups", () => {
            const doc = parse(`
primitive:
  color:
    white: "#ffffff"
semantic:
  color:
    bg: "{primitive.color.white}"
`);
            expect([...doc.keys()]).toContain("primitive");
            expect([...doc.keys()]).toContain("semantic");
        });

        it("returns Dtcg instance", () => {
            const doc = parse(`
primitive:
  color:
    white: "#ffffff"
`);
            expect(doc).toBeInstanceOf(Dtcg);
        });

        it("parses nested group structure", () => {
            const doc = parse(`
primitive:
  color:
    white: "#ffffff"
`);
            const primitive = doc.get("primitive");
            expect(primitive).toBeInstanceOf(TokenGroup);
            const color = (primitive as TokenGroup).get("color");
            expect(color).toBeInstanceOf(TokenGroup);
        });

        it("parses multiple documents and preserves their source", () => {
            const documents = new HrdtTokenReader().parseAll(`
primitive:
  number:
    value: 1
---
primitive:
  number:
    value: 2
`, "tokens.hrdt");

            expect(documents).toHaveLength(2);
            expect(documents[0].source).toBe("tokens.hrdt");
            expect(documents[1].get("primitive")).toBeInstanceOf(TokenGroup);
        });

        it("returns raw YAML values without converting tokens", () => {
            expect(new HrdtTokenReader().parseRaw("value: 1")).toEqual({ value: 1 });
        });
    });

    describe("tokens", () => {
        it("parses color hex to ColorToken", () => {
            const doc = parse(`
primitive:
  color:
    white: "#ffffff"
`);
            const token = getGroup(doc, "primitive", "color").get("white") as ColorToken;
            const value = token.value as ColorValue;
            expect(token).toBeInstanceOf(ColorToken);
            expect(value.hex).toBe("#ffffff");
            expect(value.alpha).toBe(1);
        });

        it("parses nested color palette steps", () => {
            const doc = parse(`
primitive:
  color:
    brand:
      500: "#2549f6"
semantic:
  color:
    action-primary: "{primitive.color.brand.500}"
`);
            const token = getGroup(doc, "primitive", "color", "brand").get("500") as ColorToken;

            expect(token).toBeInstanceOf(ColorToken);
            expect((token.value as ColorValue).hex).toBe("#2549f6");
            expect((getGroup(doc, "semantic", "color").get("action-primary") as TokenNode<unknown>).value)
                .toEqual(new TokenReference("primitive.color.brand.500"));
        });

        it("parses dimension token", () => {
            const doc = parse(`
primitive:
  dimension:
    space-100: 4px
`);
            const token = getGroup(doc, "primitive", "dimension").get("space-100") as DimensionToken;
            const value = token.value as DimensionValue;
            expect(token).toBeInstanceOf(DimensionToken);
            expect(value.value).toBe(4);
            expect(value.unit).toBe("px");
        });

        it("parses semantic alias as TokenReference", () => {
            const doc = parse(`
primitive:
  color:
    white: "#ffffff"
semantic:
  color:
    background-page: "{primitive.color.white}"
`);
            const token = getGroup(doc, "semantic", "color").get("background-page") as TokenNode<unknown>;
            expect(token.isAlias()).toBe(true);
            expect((token.value as TokenReference).value).toBe("primitive.color.white");
        });
    });

    describe("error handling", () => {
        it("throws HrdtTokenReaderError on invalid color", () => {
            expect(() => new HrdtTokenReader().parse(`
primitive:
  color:
    bad: "not-a-color"
`)).toThrow(HrdtTokenReaderError);
        });

        it("throws HrdtTokenReaderError when root is not an object", () => {
            expect(() => new HrdtTokenReader().parse(`
- value
`)).toThrow(HrdtTokenReaderError);
        });

        it("rejects unknown primitive token types", () => {
            expect(() => parse(`
primitive:
  unsupported:
    token: value
`)).toThrow('Unknown primitive token type: "unsupported"');
        });

        it("rejects malformed compound values", () => {
            expect(() => parse(`
primitive:
  transition:
    enter:
      duration: 100ms
      delay: 0ms
      timingFunction: [0, 1]
`)).toThrow("Expected cubicBezier");
        });

        it.each([
            ["dimension", "space: not-a-dimension", "Expected dimension"],
            ["duration", "fast: 100frames", "Expected duration"],
        ])("rejects invalid %s values", (type, value, message) => {
            expect(() => parse(`primitive:\n  ${type}:\n    ${value}`)).toThrow(message);
        });
    });
});
