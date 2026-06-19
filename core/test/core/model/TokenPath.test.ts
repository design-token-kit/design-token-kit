import { describe, it, expect } from "vitest";
import { TokenPath } from "#/core/model/TokenPath";

describe("TokenPath", () => {
    it("root is empty and renders as an empty string", () => {
        const root = TokenPath.root();
        expect(root.isRoot()).toBe(true);
        expect(root.toString()).toBe("");
        expect(root.head()).toBeUndefined();
        expect(root.segments()).toEqual([]);
    });

    it("builds from explicit segments without splitting", () => {
        const path = TokenPath.of("component", "button", "bg");
        expect(path.segments()).toEqual(["component", "button", "bg"]);
        expect(path.toString()).toBe("component.button.bg");
    });

    it("parses a dotted string", () => {
        expect(TokenPath.parse("primitive.color.red").segments()).toEqual(["primitive", "color", "red"]);
        expect(TokenPath.parse("").isRoot()).toBe(true);
    });

    it("returns the first segment as head", () => {
        expect(TokenPath.parse("component.button.bg").head()).toBe("component");
    });

    it("appends a segment immutably", () => {
        const parent = TokenPath.of("primitive");
        const child = parent.child("color");
        expect(child.toString()).toBe("primitive.color");
        expect(parent.toString()).toBe("primitive");
    });

    it("does not expose its internal segment array for mutation", () => {
        const path = TokenPath.of("a", "b");
        const segments = path.segments() as string[];
        segments.push("c");
        expect(path.toString()).toBe("a.b");
    });

    it("compares by value", () => {
        expect(TokenPath.of("a", "b").equals(TokenPath.parse("a.b"))).toBe(true);
        expect(TokenPath.of("a", "b").equals(TokenPath.of("a"))).toBe(false);
        expect(TokenPath.of("a", "b").equals(TokenPath.of("a", "c"))).toBe(false);
    });
});
