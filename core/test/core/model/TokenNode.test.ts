import { describe, it, expect } from "vitest";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

describe("TokenNode", () => {
    describe("isAlias", () => {
        it("returns false for direct value", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            expect(token.isAlias()).toBe(false);
        });

        it("returns true for TokenReference value", () => {
            const token = new ColorToken(new TokenReference("color.base.red"));
            expect(token.isAlias()).toBe(true);
        });
    });

    describe("type", () => {
        it.each([
            ["color", new ColorToken(new ColorValue("srgb", [0, 0, 0]))],
            ["dimension", new DimensionToken(new DimensionValue(4, "px"))],
            ["number", new NumberToken(1.5)],
        ] as const)("reports $type for %s token", (expectedType, token) => {
            expect(token.type).toBe(expectedType);
        });
    });

    describe("optional metadata", () => {
        it("stores description", () => {
            const token = new NumberToken(0, "opacity scale factor");
            expect(token.description).toBe("opacity scale factor");
        });

        it("stores deprecated flag", () => {
            const token = new NumberToken(0, undefined, true);
            expect(token.deprecated).toBe(true);
        });

        it("stores deprecated message", () => {
            const token = new NumberToken(0, undefined, "use opacity.scale instead");
            expect(token.deprecated).toBe("use opacity.scale instead");
        });

        it("stores extensions", () => {
            const ext = { "com.example": { foo: "bar" } };
            const token = new NumberToken(0, undefined, undefined, ext);
            expect(token.extensions).toEqual(ext);
        });

        it("leaves optional fields undefined by default", () => {
            const token = new NumberToken(42);
            expect(token.description).toBeUndefined();
            expect(token.deprecated).toBeUndefined();
            expect(token.extensions).toBeUndefined();
        });
    });
});
