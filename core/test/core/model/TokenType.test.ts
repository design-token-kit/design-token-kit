import { describe, expect, it } from "vitest";
import { isTokenType, TOKEN_TYPES } from "#/core/model/TokenType";

describe("isTokenType", () => {
    it("accepts every DTCG type", () => {
        expect(TOKEN_TYPES.every((type) => isTokenType(type))).toBe(true);
    });

    it("rejects unknown names and non-strings", () => {
        expect(isTokenType("colour")).toBe(false);
        expect(isTokenType(42)).toBe(false);
        expect(isTokenType(undefined)).toBe(false);
    });
});
