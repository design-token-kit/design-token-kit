import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { HrdtTokenReader } from "#/core/io/HrdtTokenReader";
import { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

const TOKENS_DIR = resolve(__dirname, "../../../tokens");

function write(doc: Dtcg): string {
    return new HrdtTokenWriter().write(doc);
}

async function roundTrip(name: string): Promise<Dtcg> {
    const content = await readFile(resolve(TOKENS_DIR, name), "utf8");
    const doc = new HrdtTokenReader().parse(content);
    return new HrdtTokenReader().parse(write(doc));
}

describe("HrdtTokenWriter", () => {
    describe("round-trip with valid.yaml", () => {
        it("produces output readable by HrdtTokenReader", async () => {
            const content = await readFile(resolve(TOKENS_DIR, "valid.yaml"), "utf8");
            const doc = new HrdtTokenReader().parse(content);
            const written = new HrdtTokenWriter().write(doc);
            expect(() => new HrdtTokenReader().parse(written)).not.toThrow();
        });

        it("preserves top-level group keys", async () => {
            const doc = await roundTrip("valid.yaml");
            expect([...doc.keys()]).toEqual(["primitive", "semantic", "component"]);
        });
    });

    describe("writes tokens", () => {
        it("writes color token as hex string", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"));
            const colors = new TokenGroup({ children: new Map([["red", token]]) });
            const primitive = new TokenGroup({ children: new Map([["color", colors]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("red: #ff0000");
        });

        it("writes dimension token", () => {
            const token = new DimensionToken(new DimensionValue(8, "px"));
            const dimensions = new TokenGroup({ children: new Map([["space", token]]) });
            const primitive = new TokenGroup({ children: new Map([["dimension", dimensions]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("space: 8px");
        });

        it("writes number token", () => {
            const token = new NumberToken(1.5);
            const numbers = new TokenGroup({ children: new Map([["ratio", token]]) });
            const primitive = new TokenGroup({ children: new Map([["number", numbers]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("ratio: 1.5");
        });
    });

    describe("writes aliases", () => {
        it("writes token reference as quoted curly-brace string", () => {
            const token = new ColorToken(new TokenReference("primitive.color.white"));
            const colors = new TokenGroup({ children: new Map([["bg", token]]) });
            const semantic = new TokenGroup({ children: new Map([["color", colors]]) });
            const root = new TokenGroup({ children: new Map([["semantic", semantic]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('bg: "{primitive.color.white}"');
        });
    });
});
