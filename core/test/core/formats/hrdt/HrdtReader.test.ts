import { describe, it, expect } from "vitest";
import { HrdtReader } from "#/core/formats/hrdt/HrdtReader";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

async function parse(yaml: string): Promise<Dtcg> {
    const result = await HrdtReader.noSchema().read(yaml);
    if (!result.ok) {
        expect.fail(`fixture could not be read:\n${result.issues.map((issue) => issue.message).join("\n")}`);
    }
    return result.documents[0];
}

/** Reads multi-document content, failing the test when it cannot be read. */
async function parseAll(yaml: string, source?: string): Promise<Dtcg[]> {
    const result = await HrdtReader.noSchema().read(yaml, source);
    if (!result.ok) {
        expect.fail(`fixture could not be read:\n${result.issues.map((issue) => issue.message).join("\n")}`);
    }
    return result.documents;
}

/** Reads content expected to fail, returning the diagnostic messages. */
async function messagesOf(yaml: string): Promise<string[]> {
    const result = await HrdtReader.noSchema().read(yaml);
    if (result.ok) {
        expect.fail("expected the read to fail");
    }
    return result.issues.map((issue) => issue.message);
}

/** Reads content expected to fail, returning the diagnostic ids. */
async function issuesOf(yaml: string): Promise<string[]> {
    const result = await HrdtReader.noSchema().read(yaml);
    if (result.ok) {
        expect.fail("expected the read to fail");
    }
    return result.issues.map((issue) => issue.id);
}

function getGroup(doc: Dtcg, ...path: string[]): TokenGroup {
    let node: ReturnType<Dtcg["get"]> = doc.get(path[0]);
    for (const key of path.slice(1)) {
        node = (node as TokenGroup).get(key);
    }
    return node as TokenGroup;
}

describe("HrdtReader", () => {
    describe("document structure", () => {
        it("parses top-level groups", async () => {
            const doc = await parse(`
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

        it("returns Dtcg instance", async () => {
            const doc = await parse(`
primitive:
  color:
    white: "#ffffff"
`);
            expect(doc).toBeInstanceOf(Dtcg);
        });

        it("parses nested group structure", async () => {
            const doc = await parse(`
primitive:
  color:
    white: "#ffffff"
`);
            const primitive = doc.get("primitive");
            expect(primitive).toBeInstanceOf(TokenGroup);
            const color = (primitive as TokenGroup).get("color");
            expect(color).toBeInstanceOf(TokenGroup);
        });

        it("parses multiple documents and preserves their source", async () => {
            const documents = await parseAll(`
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

        it("rejects YAML syntax errors in multi-document content", async () => {
            const broken = "primitive:\n  number:\n    value: [1, 2\n---\nprimitive: {}\n";
            await expect(issuesOf(broken)).resolves.not.toHaveLength(0);
        });
    });

    describe("tokens", () => {
        it("parses color hex to ColorToken", async () => {
            const doc = await parse(`
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

        it("parses nested color palette steps", async () => {
            const doc = await parse(`
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

        it("parses dimension token", async () => {
            const doc = await parse(`
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

        it("parses semantic alias as TokenReference", async () => {
            const doc = await parse(`
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
        it("reports an invalid color", async () => {
            await expect(issuesOf(`
primitive:
  color:
    bad: "not-a-color"
`)).resolves.toContain("invalid-color");
        });

        it("reports a root that is not an object", async () => {
            await expect(issuesOf("\n- value\n")).resolves.not.toHaveLength(0);
        });

        it("rejects unknown primitive token types", async () => {
            const issues = await messagesOf(`
primitive:
  unsupported:
    token: value
`);
            expect(issues.join("\n")).toContain('Unknown primitive token type: "unsupported"');
        });

        it("rejects malformed compound values", async () => {
            const issues = await messagesOf(`
primitive:
  transition:
    enter:
      duration: 100ms
      delay: 0ms
      timingFunction: [0, 1]
`);
            expect(issues.join("\n")).toContain("Expected cubicBezier");
        });

        it.each([
            ["dimension", "space: not-a-dimension", "Expected dimension"],
            ["duration", "fast: 100frames", "Expected duration"],
        ])("rejects invalid %s values", async (type, value, message) => {
            const issues = await messagesOf(`primitive:\n  ${type}:\n    ${value}`);
            expect(issues.join("\n")).toContain(message);
        });
    });
});
