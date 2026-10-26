import { describe, expect, it } from "vitest";
import { findSoleVarReference, findVarReferences } from "#/core/platforms/css/CssVarReferences";

describe("findVarReferences", () => {
    it("finds a reference without fallback", () => {
        expect(findVarReferences("var(--a)")).toEqual([{ customProperty: "--a", fallback: undefined }]);
    });

    it("keeps the fallback text, including nested references", () => {
        expect(findVarReferences("var( --a , var(--b, 1px) )")).toEqual([
            { customProperty: "--a", fallback: "var(--b, 1px)" },
        ]);
    });

    it("finds every reference inside other functions in source order", () => {
        expect(findVarReferences("calc(var(--a) * 2) solid VAR(--b)")).toEqual([
            { customProperty: "--a", fallback: undefined },
            { customProperty: "--b", fallback: undefined },
        ]);
    });

    it("keeps an empty fallback", () => {
        expect(findVarReferences("var(--a,)")).toEqual([{ customProperty: "--a", fallback: "" }]);
    });

    it("ignores values without references and functions ending in var", () => {
        expect(findVarReferences("24px")).toEqual([]);
        expect(findVarReferences("myvar(--a)")).toEqual([]);
    });

    it("ignores parentheses inside strings and comments", () => {
        expect(findVarReferences("var(--sep, \")\")")).toEqual([{ customProperty: "--sep", fallback: "\")\"" }]);
        expect(findVarReferences("var(--a, /* ) */ red)")).toEqual([
            { customProperty: "--a", fallback: "/* ) */ red" },
        ]);
        expect(findVarReferences("var(--a, 'it\\')s')")).toEqual([
            { customProperty: "--a", fallback: "'it\\')s'" },
        ]);
    });

    it("ignores references inside strings and comments", () => {
        expect(findVarReferences("\"var(--x)\"")).toEqual([]);
        expect(findVarReferences("/* var(--x) */ var(--y)")).toEqual([
            { customProperty: "--y", fallback: undefined },
        ]);
    });

    it("stops at an unclosed reference", () => {
        expect(findVarReferences("var(--a")).toEqual([]);
    });
});

describe("findSoleVarReference", () => {
    it("returns the reference when it is the whole value", () => {
        expect(findSoleVarReference("  var(--a, red) ")).toEqual({ customProperty: "--a", fallback: "red" });
    });

    it("returns undefined when the value has more than the reference", () => {
        expect(findSoleVarReference("1px solid var(--a)")).toBeUndefined();
        expect(findSoleVarReference("var(--a) var(--b)")).toBeUndefined();
        expect(findSoleVarReference("#fff")).toBeUndefined();
    });
});
