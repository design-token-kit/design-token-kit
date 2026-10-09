import { describe, it, expect } from "vitest";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { PlatformFormat } from "#/core/platforms/PlatformFormat";

// The values are the names the CLI accepts, so changing one breaks existing
// commands and scripts.
describe("TokenFormat", () => {
    it("names the formats tokens can be read from", () => {
        expect(Object.values(TokenFormat)).toEqual(["dtcg", "hrdt", "design-md"]);
    });

    it("defines DTCG with value dtcg", () => {
        expect(TokenFormat.DTCG).toBe("dtcg");
    });

    it("defines HRDT with value hrdt", () => {
        expect(TokenFormat.HRDT).toBe("hrdt");
    });

    it("defines DESIGN_MD with value design-md", () => {
        expect(TokenFormat.DESIGN_MD).toBe("design-md");
    });

    it("holds no platform output, CSS included", () => {
        expect(Object.values(TokenFormat)).not.toContain("css");
    });
});

describe("PlatformFormat", () => {
    it("names the platform sources tokens can be generated into", () => {
        expect(Object.values(PlatformFormat))
            .toEqual(["css", "scss", "tailwind-v4", "swiftui", "figma-script", "android"]);
    });

    it("defines CSS with value css", () => {
        expect(PlatformFormat.CSS).toBe("css");
    });

    it("defines SCSS with value scss", () => {
        expect(PlatformFormat.SCSS).toBe("scss");
    });

    it("defines TAILWIND_V4 with value tailwind-v4", () => {
        expect(PlatformFormat.TAILWIND_V4).toBe("tailwind-v4");
    });

    it("defines SWIFT_UI with value swiftui", () => {
        expect(PlatformFormat.SWIFT_UI).toBe("swiftui");
    });

    it("defines FIGMA_SCRIPT with value figma-script", () => {
        expect(PlatformFormat.FIGMA_SCRIPT).toBe("figma-script");
    });

    it("defines ANDROID with value android", () => {
        expect(PlatformFormat.ANDROID).toBe("android");
    });
});

describe("the two enums", () => {
    it("share no member, so a format is either read or generated", () => {
        const tokens = new Set<string>(Object.values(TokenFormat));
        expect(Object.values(PlatformFormat).filter((it) => tokens.has(it))).toEqual([]);
    });
});
