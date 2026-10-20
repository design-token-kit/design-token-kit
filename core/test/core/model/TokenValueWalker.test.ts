import { describe, it, expect } from "vitest";
import { walkTokenValue } from "#/core/model/TokenValueWalker";
import type { ValueLeaf } from "#/core/model/TokenValueWalker";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { TokenNode } from "#/core/model/TokenNode";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { BorderValue } from "#/core/model/values/BorderValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }
function dim(): DimensionValue { return new DimensionValue(2, "px"); }
function ref(path: string): TokenReference { return new TokenReference(path); }

function leaves(token: TokenNode<unknown>): ValueLeaf[] {
    const collected: ValueLeaf[] = [];
    walkTokenValue(token, (leaf) => collected.push(leaf));
    return collected;
}

function refs(token: TokenNode<unknown>): string[] {
    return leaves(token)
        .filter((l) => l.kind === "ref")
        .map((l) => (l.value as TokenReference).value);
}

function rawCount(token: TokenNode<unknown>): number {
    return leaves(token).filter((l) => l.kind === "raw").length;
}

describe("walkTokenValue", () => {
    it("yields a plain value as a single raw leaf with no refs", () => {
        const out = leaves(new ColorToken(color()));
        expect(refs(new ColorToken(color()))).toEqual([]);
        expect(out.filter((l) => l.kind === "raw")).toHaveLength(1);
    });

    it("yields a direct reference as a single ref leaf with no raw leaves", () => {
        const token = new AliasToken(ref("primitive.color.red"));
        expect(refs(token)).toEqual(["primitive.color.red"]);
        expect(rawCount(token)).toBe(0);
    });

    it("splits a composite with a raw field into refs and raw leaves", () => {
        const border = new BorderValue(ref("primitive.color.red"), dim(), "solid");
        const token = new BorderToken(border);
        expect(refs(token)).toEqual(["primitive.color.red"]);
        expect(rawCount(token)).toBe(2);
    });

    it("yields no raw leaves for a fully-referenced composite", () => {
        const border = new BorderValue(ref("primitive.color.red"), ref("primitive.dim.w"), ref("primitive.stroke.s"));
        const token = new BorderToken(border);
        expect(refs(token)).toEqual(["primitive.color.red", "primitive.dim.w", "primitive.stroke.s"]);
        expect(rawCount(token)).toBe(0);
    });

    it("yields refs from typography fields with no raw leaves", () => {
        const typo = new TypographyValue(
            ref("primitive.fontFamily.body"),
            ref("primitive.dim.size"),
            ref("primitive.fontWeight.bold"),
            ref("primitive.dim.spacing"),
            ref("primitive.number.lh"),
        );
        const token = new TypographyToken(typo);
        expect(rawCount(token)).toBe(0);
        expect(refs(token)).toHaveLength(5);
    });

    it("splits a gradient array into refs and raw leaves", () => {
        const gradient = [
            new GradientStop(ref("primitive.color.a"), 0),
            new GradientStop(color(), 1),
        ];
        const token = new GradientToken(gradient);
        expect(refs(token)).toEqual(["primitive.color.a"]);
        expect(rawCount(token)).toBeGreaterThan(0);
    });

    it("walks colorSpace and hex property references", () => {
        const colorSpace = new TokenReference("#/primitive/color/space/$value", "property");
        const hex = new TokenReference("#/primitive/color/hex/$value", "property");
        const value = new ColorValue(
            colorSpace as unknown as "srgb",
            [1, 0, 0],
            1,
            hex as unknown as string,
        );

        expect(refs(new ColorToken(value))).toEqual([
            "#/primitive/color/space/$value",
            "#/primitive/color/hex/$value",
        ]);
    });

    it("does not treat default color alpha as a raw value when another field is a reference", () => {
        const component = new TokenReference("#/primitive/color/component/$value", "property");
        const token = new ColorToken(new ColorValue("srgb", [component], 1, "#ff0000"));

        expect(refs(token)).toEqual(["#/primitive/color/component/$value"]);
        expect(rawCount(token)).toBe(0);
    });

    it("walks property references nested inside composite fields", () => {
        const width = new DimensionValue(new TokenReference("#/primitive/number/width/$value", "property"), "px");
        const token = new BorderToken(new BorderValue(color(), width, "solid"));

        expect(refs(token)).toEqual(["#/primitive/number/width/$value"]);
    });

    it("walks inset references in shadow arrays", () => {
        const inset = new TokenReference("#/primitive/number/inset/$value", "property");
        const shadow = new ShadowLayer(color(), dim(), dim(), dim(), dim(), inset);

        expect(refs(new ShadowToken([shadow]))).toEqual(["#/primitive/number/inset/$value"]);
    });
});
