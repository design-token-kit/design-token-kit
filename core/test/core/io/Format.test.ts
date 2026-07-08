import { describe, it, expect } from "vitest";
import { Format } from "#/core/io/Format";

describe("Format", () => {
    it("defines DTCG with value dtcg", () => {
        expect(Format.DTCG).toBe("dtcg");
    });

    it("defines HRDT with value hrdt", () => {
        expect(Format.HRDT).toBe("hrdt");
    });

    it("defines DESIGN_MD with value design-md", () => {
        expect(Format.DESIGN_MD).toBe("design-md");
    });

    it("defines CSS with value css", () => {
        expect(Format.CSS).toBe("css");
    });

    it("defines SCSS with value scss", () => {
        expect(Format.SCSS).toBe("scss");
    });

    it("defines TAILWIND_V4 with value tailwind-v4", () => {
        expect(Format.TAILWIND_V4).toBe("tailwind-v4");
    });

    it("has exactly 6 members", () => {
        expect(Object.keys(Format).filter((k) => isNaN(Number(k)))).toHaveLength(6);
    });
});
