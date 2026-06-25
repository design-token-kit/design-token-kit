import { describe, it, expect } from "vitest";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenNode } from "#/core/model/TokenNode";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { ColorValue } from "#/core/model/values/ColorValue";

function makeColorToken() {
    return new ColorToken(new ColorValue("srgb", [1, 0, 0]));
}

function children(entries: Array<[string, TokenGroup | TokenNode<unknown>]>): Map<string, TokenGroup | TokenNode<unknown>> {
    return new Map(entries);
}

describe("TokenGroup", () => {
    it("is empty by default", () => {
        const group = new TokenGroup();
        expect(group.size).toBe(0);
    });

    it("retrieves child by name", () => {
        const token = makeColorToken();
        const group = new TokenGroup({ children: new Map([["red", token]]) });
        expect(group.get("red")).toBe(token);
    });

    it("returns undefined for missing child", () => {
        const group = new TokenGroup();
        expect(group.get("missing")).toBeUndefined();
    });

    it("has returns true for existing child", () => {
        const group = new TokenGroup({ children: new Map([["red", makeColorToken()]]) });
        expect(group.has("red")).toBe(true);
        expect(group.has("blue")).toBe(false);
    });

    it("iterates keys in insertion order", () => {
        const group = new TokenGroup({
            children: new Map([
                ["red", makeColorToken()],
                ["blue", makeColorToken()],
                ["green", makeColorToken()],
            ]),
        });
        expect([...group.keys()]).toEqual(["red", "blue", "green"]);
    });

    it("iterates entries", () => {
        const token = makeColorToken();
        const group = new TokenGroup({ children: new Map([["red", token]]) });
        const entries = [...group.entries()];
        expect(entries).toHaveLength(1);
        expect(entries[0][0]).toBe("red");
        expect(entries[0][1]).toBe(token);
    });

    it("stores inherited type", () => {
        const group = new TokenGroup({ type: "color" });
        expect(group.type).toBe("color");
    });

    it("stores nested groups", () => {
        const inner = new TokenGroup({ children: new Map([["red", makeColorToken()]]) });
        const outer = new TokenGroup({ children: new Map([["primitive", inner]]) });
        expect(outer.get("primitive")).toBe(inner);
    });

    describe("walk", () => {
        it("visits the group itself first, then children pre-order", () => {
            const inner = new TokenGroup({ children: new Map([["red", makeColorToken()]]) });
            const root = new TokenGroup({ children: children([["primitive", inner], ["semantic", makeColorToken()]]) });

            const paths: string[] = [];
            root.walk((_node, path) => paths.push(path.toString()));

            expect(paths).toEqual(["", "primitive", "primitive.red", "semantic"]);
        });

        it("descends into nested groups depth-first", () => {
            const leaf = new TokenGroup({ children: new Map([["bg", makeColorToken()]]) });
            const mid = new TokenGroup({ children: new Map([["button", leaf]]) });
            const root = new TokenGroup({ children: children([["component", mid], ["other", makeColorToken()]]) });

            const paths: string[] = [];
            root.walk((_node, path) => paths.push(path.toString()), TokenPath.root());

            expect(paths).toEqual(["", "component", "component.button", "component.button.bg", "other"]);
        });

        it("passes each node with its path", () => {
            const token = makeColorToken();
            const root = new TokenGroup({ children: new Map([["red", token]]) });

            const visited: Array<[string, unknown]> = [];
            root.walk((node, path) => visited.push([path.toString(), node]));

            expect(visited).toEqual([["", root], ["red", token]]);
        });

        it("starts paths from the given base path", () => {
            const root = new TokenGroup({ children: new Map([["red", makeColorToken()]]) });

            const paths: string[] = [];
            root.walk((_node, path) => paths.push(path.toString()), TokenPath.of("theme"));

            expect(paths).toEqual(["theme", "theme.red"]);
        });
    });
});
