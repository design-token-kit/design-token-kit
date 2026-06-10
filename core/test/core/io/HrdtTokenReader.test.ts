import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HrdtTokenReader, HrdtTokenReaderError } from "#/core/io/HrdtTokenReader";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

const TOKENS_DIR = resolve(__dirname, "../../../tokens");

async function loadFixture(name: string): Promise<Dtcg> {
    return new HrdtTokenReader().parse(await readFile(resolve(TOKENS_DIR, name), "utf8"));
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
        it("parses top-level groups", async () => {
            const doc = await loadFixture("valid.yaml");
            expect([...doc.keys()]).toContain("primitive");
            expect([...doc.keys()]).toContain("semantic");
        });

        it("returns Dtcg instance", async () => {
            const doc = await loadFixture("valid.yaml");
            expect(doc).toBeInstanceOf(Dtcg);
        });

        it("parses nested group structure", async () => {
            const doc = await loadFixture("valid.yaml");
            const primitive = doc.get("primitive");
            expect(primitive).toBeInstanceOf(TokenGroup);
            const color = (primitive as TokenGroup).get("color");
            expect(color).toBeInstanceOf(TokenGroup);
        });
    });

    describe("tokens", () => {
        it("parses color hex to ColorToken", async () => {
            const doc = await loadFixture("valid.yaml");
            const token = getGroup(doc, "primitive", "color").get("white") as ColorToken;
            const value = token.value as ColorValue;
            expect(token).toBeInstanceOf(ColorToken);
            expect(value.hex).toBe("#ffffff");
            expect(value.alpha).toBe(1);
        });

        it("parses dimension token", async () => {
            const doc = await loadFixture("valid.yaml");
            const token = getGroup(doc, "primitive", "dimension").get("space-100") as DimensionToken;
            const value = token.value as DimensionValue;
            expect(token).toBeInstanceOf(DimensionToken);
            expect(value.value).toBe(4);
            expect(value.unit).toBe("px");
        });

        it("parses semantic alias as TokenReference", async () => {
            const doc = await loadFixture("valid.yaml");
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
    });
});
