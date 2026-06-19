import { describe, it, expect } from "vitest";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import type { TokenNode } from "#/core/model/TokenNode";

function makeColor(alpha = 1): ColorValue {
    return new ColorValue("srgb", [1, 0, 0], alpha);
}

function makeDoc(children: Map<string, TokenGroup | TokenNode<unknown>>): Dtcg {
    return new Dtcg(new TokenGroup({ children }));
}

describe("Dtcg", () => {
    describe("basic API", () => {
        it("delegates get to root group", () => {
            const token = new ColorToken(makeColor());
            const doc = makeDoc(new Map([["red", token]]));
            expect(doc.get("red")).toBe(token);
        });

        it("returns undefined for missing key", () => {
            expect(new Dtcg(new TokenGroup()).get("missing")).toBeUndefined();
        });

        it("reports size", () => {
            const doc = makeDoc(new Map([["a", new ColorToken(makeColor())], ["b", new ColorToken(makeColor())]]));
            expect(doc.size).toBe(2);
        });

        it("iterates top-level keys", () => {
            const root = new TokenGroup({ children: new Map([["primitive", new TokenGroup()], ["semantic", new TokenGroup()]]) });
            expect([...new Dtcg(root).keys()]).toEqual(["primitive", "semantic"]);
        });

        it("walks the document pre-order starting from the root path", () => {
            const inner = new TokenGroup({ children: new Map([["red", new ColorToken(makeColor())]]) });
            const doc = new Dtcg(new TokenGroup({ children: new Map([["primitive", inner]]) }));

            const paths: string[] = [];
            doc.walk((_node, path) => paths.push(path.toString()));

            expect(paths).toEqual(["", "primitive", "primitive.red"]);
        });
    });
});
