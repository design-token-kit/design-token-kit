import { describe, it, expect } from "vitest";
import { TokenReference } from "#/core/model/TokenReference";

describe("TokenReference", () => {
    it("stores path without curly braces", () => {
        const ref = new TokenReference("color.base.red");
        expect(ref.value).toBe("color.base.red");
    });

    it("serializes to curly-brace notation", () => {
        const ref = new TokenReference("color.base.red");
        expect(ref.kind).toBe("alias");
        expect(ref.toString()).toBe("{color.base.red}");
    });

    it("preserves nested path segments", () => {
        const ref = new TokenReference("semantic.color.text.primary");
        expect(ref.value).toBe("semantic.color.text.primary");
        expect(ref.toString()).toBe("{semantic.color.text.primary}");
    });

    it("parses a property-level JSON Pointer reference", () => {
        const ref = TokenReference.parse({ "$ref": "#/primitive/opacity/disabled/$value" });

        expect(ref?.isPropertyReference).toBe(true);
        expect(ref?.isTokenReference).toBe(false);
        expect(ref?.pointer).toBe("#/primitive/opacity/disabled/$value");
        expect(ref?.toString()).toBe("#/primitive/opacity/disabled/$value");
    });

    it("parses a token-level JSON Pointer reference", () => {
        const ref = TokenReference.parseTokenReference("#/primitive/color/blue/$value");

        expect(ref?.isPropertyReference).toBe(false);
        expect(ref?.isTokenReference).toBe(true);
        expect(ref?.toString()).toBe("#/primitive/color/blue/$value");
    });

    it("parses a token-level pointer to a nested property as a property reference", () => {
        const ref = TokenReference.parseTokenReference("#/primitive/color/blue/$value/components/0");

        expect(ref?.isPropertyReference).toBe(true);
        expect(ref?.isTokenReference).toBe(false);
        expect(ref?.toString()).toBe("#/primitive/color/blue/$value/components/0");
    });

    it("rejects malformed JSON Pointer references", () => {
        expect(TokenReference.parse({ "$ref": "primitive/color/blue/$value" })).toBeUndefined();
        expect(TokenReference.parse({ "$ref": "#/primitive/color/blue/$value", "extra": true })).toBeUndefined();
        expect(TokenReference.parseTokenReference("primitive/color/blue/$value")).toBeUndefined();
    });

    it("preserves escaped JSON Pointer segments", () => {
        const ref = TokenReference.parse({ "$ref": "#/group/a~1b/c~0d/$value" });

        expect(ref?.pointer).toBe("#/group/a~1b/c~0d/$value");
        expect(ref?.toString()).toBe("#/group/a~1b/c~0d/$value");
    });
});
