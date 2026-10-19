import { describe, it, expect } from "vitest";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import type { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";

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

        it("resolves theme references against the base document", () => {
            const base = new Dtcg(new TokenGroup({
                children: new Map([
                    ["primitive", new TokenGroup({
                        children: new Map([
                            ["color", new TokenGroup({
                                children: new Map([
                                    ["white", new ColorToken(makeColor())],
                                ]),
                            })],
                        ]),
                    })],
                ]),
            }));
            const theme = new Dtcg(new TokenGroup({
                children: new Map([
                    ["semantic", new TokenGroup({
                        children: new Map([
                            ["text", new TokenGroup({
                                children: new Map([
                                    ["default", new AliasToken(new TokenReference("primitive.color.white"))],
                                ]),
                            })],
                        ]),
                    })],
                ]),
            }));

            const ref = new TokenReference("primitive.color.white");
            expect(theme.resolveChain(ref, base)).toBe(base.resolveChain(ref));
        });

        it("resolves property references to nested values and reports their owner", () => {
            const color = new ColorToken(new ColorValue("srgb", [0.1, 0.4, 0.9]));
            const doc = makeDoc(new Map([
                ["primitive", new TokenGroup({
                    children: new Map([["color", new TokenGroup({
                        children: new Map([["blue", color]]),
                    })]]),
                })],
            ]));
            const reference = new TokenReference("#/primitive/color/blue/$value/components/1", true);

            expect(doc.resolveReferenceValue(reference)).toBe(0.4);
            expect(doc.resolveRef(reference)).toEqual({
                node: color,
                path: expect.objectContaining({
                    toString: expect.any(Function),
                }),
            });
            expect(doc.resolveRef(reference)?.path.toString()).toBe("primitive.color.blue");
        });

        it("falls back to the base document for property references", () => {
            const baseColor = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            const base = makeDoc(new Map([["primitive", new TokenGroup({
                children: new Map([["color", new TokenGroup({
                    children: new Map([["red", baseColor]]),
                })]]),
            })]]));
            const theme = makeDoc(new Map());
            const reference = new TokenReference("#/primitive/color/red/$value/components", true);

            expect(theme.resolveReferenceValue(reference, base)).toEqual([1, 0, 0]);
            expect(theme.resolveRef(reference, base)?.node).toBe(baseColor);
        });

        it("returns undefined for missing, group, and invalid array pointers", () => {
            const color = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            const doc = makeDoc(new Map([
                ["colors", new TokenGroup({ root: color })],
            ]));

            expect(doc.resolveReferenceValue(new TokenReference("#/missing/$value", true))).toBeUndefined();
            expect(doc.resolveRef(new TokenReference("#/colors", true))?.node).toBeInstanceOf(TokenGroup);
            expect(doc.resolveReferenceValue(new TokenReference("#/colors/$root/$value/components/4", true)))
                .toBeUndefined();
            expect(doc.resolveReferenceValue(new TokenReference("#/colors/$root/$value/components/0", true))).toBe(1);
        });

        it("falls back when a theme group is present but the pointer target is missing", () => {
            const baseColor = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            const base = makeDoc(new Map([["primitive", new TokenGroup({
                children: new Map([["color", new TokenGroup({
                    children: new Map([["red", baseColor]]),
                })]]),
            })]]));
            const theme = makeDoc(new Map([["primitive", new TokenGroup()]]));
            const reference = new TokenReference("#/primitive/color/red/$value/components", true);

            expect(theme.resolveReferenceValue(reference, base)).toEqual([1, 0, 0]);
        });

        it("decodes URI fragment encoding and resolves group pointers", () => {
            const token = new ColorToken(makeColor());
            const group = new TokenGroup({ children: new Map([["brand color", token]]) });
            const doc = makeDoc(new Map([["base", group]]));

            expect(doc.resolveReferenceValue(new TokenReference("#/base/brand%20color/$value", true)))
                .toEqual(makeColor());
            expect(doc.resolveRef(new TokenReference("#/base", true))?.node).toBe(group);
        });
    });
});
