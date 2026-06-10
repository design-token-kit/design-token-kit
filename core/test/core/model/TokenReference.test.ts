import { describe, it, expect } from "vitest";
import { TokenReference } from "#/core/model/TokenReference";

describe("TokenReference", () => {
    it("stores path without curly braces", () => {
        const ref = new TokenReference("color.base.red");
        expect(ref.value).toBe("color.base.red");
    });

    it("serializes to curly-brace notation", () => {
        expect(new TokenReference("color.base.red").toString()).toBe("{color.base.red}");
    });

    it("preserves nested path segments", () => {
        const ref = new TokenReference("semantic.color.text.primary");
        expect(ref.value).toBe("semantic.color.text.primary");
        expect(ref.toString()).toBe("{semantic.color.text.primary}");
    });
});
