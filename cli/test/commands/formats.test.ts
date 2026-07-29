import { describe, it, expect } from "vitest";
import { Dtcg, Format, TokenGroup, DtcgJsonReader, DtcgList, SwiftUiTokenConverter } from "@design-token-kit/core";
import { getReader, getWriter, toDocumentFormat } from "#/commands/formats";

describe("toDocumentFormat", () => {
    it("returns DTCG for 'dtcg'", () => {
        expect(toDocumentFormat("dtcg")).toBe(Format.DTCG);
    });

    it("returns HRDT for 'hrdt'", () => {
        expect(toDocumentFormat("hrdt")).toBe(Format.HRDT);
    });

    it("returns DESIGN_MD for 'design-md'", () => {
        expect(toDocumentFormat("design-md")).toBe(Format.DESIGN_MD);
    });

    it("returns fallback when format is undefined", () => {
        expect(toDocumentFormat(undefined)).toBe(Format.DTCG);
    });

    it("uses custom fallback when format is undefined", () => {
        expect(toDocumentFormat(undefined, Format.HRDT)).toBe(Format.HRDT);
    });

    it("throws for unknown format", () => {
        expect(() => toDocumentFormat("css")).toThrow("Unknown format \"css\"");
    });
});

describe("getReader", () => {
    it("reads DTCG JSON", () => {
        const reader = getReader("dtcg");
        const doc = reader.read("{}");
        expect(doc).toBeInstanceOf(Dtcg);
    });

    it("reads HRDT YAML", () => {
        const reader = getReader("hrdt");
        const doc = reader.read("primitive:\n  color:\n    white: \"#ffffff\"");
        expect(doc).toBeInstanceOf(Dtcg);
    });

    it("reads DESIGN.md", () => {
        const reader = getReader("design-md");
        const doc = reader.read("<!-- Colors -->\n#ffffff");
        expect(doc).toBeInstanceOf(Dtcg);
    });

    it("returns DTCG reader and reads when format is undefined", () => {
        const reader = getReader();
        const doc = reader.read("{}");
        expect(doc).toBeInstanceOf(Dtcg);
    });

    it("throws for invalid format", () => {
        expect(() => getReader("css")).toThrow("Unknown format \"css\"");
    });
});

describe("getWriter", () => {
    const doc = new Dtcg(new TokenGroup());

    it("writes DTCG JSON", () => {
        const writer = getWriter("dtcg");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("writes HRDT YAML", () => {
        const writer = getWriter("hrdt");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("writes DESIGN.md", () => {
        const writer = getWriter("design-md");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("writes CSS", () => {
        const writer = getWriter("css");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("writes SCSS", () => {
        const writer = getWriter("scss");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("writes TAILWIND_V4", () => {
        const writer = getWriter("tailwind-v4");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("maps 'tailwind' to TAILWIND_V4 writer", () => {
        const writer = getWriter("tailwind");
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("returns CSS writer and writes when format is undefined", () => {
        const writer = getWriter();
        const out = writer.write(doc);
        expect(typeof out).toBe("string");
    });

    it("throws for invalid format", () => {
        expect(() => getWriter("unknown")).toThrow("Unknown format \"unknown\"");
    });

    it("writes SwiftUI output", () => {
        const doc = new DtcgJsonReader().parse(
            JSON.stringify({ spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } }),
        );
        const out = getWriter(Format.SWIFT_UI).write(doc);
        expect(out).toContain("enum DesignTokens {");
        expect(out).toContain("static let md: CGFloat = 16");
    });
});

describe("SwiftUI multi-theme conversion", () => {
    function themedList(): DtcgList {
        const reader = new DtcgJsonReader();
        const base = reader.parse(
            JSON.stringify({
                color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            }),
        );
        const dark = reader.parse(
            JSON.stringify({
                color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1] } } },
            }),
        );
        return new DtcgList(base, new Map([["dark", dark]]));
    }

    it("emits a theme enum for the enum form", () => {
        const out = new SwiftUiTokenConverter({ swiftType: "enum" }).convertList(themedList());
        expect(out).toContain("enum DesignTokensDark {");
    });

    it("emits the Theme struct and a theme instance for the struct form", () => {
        const out = new SwiftUiTokenConverter({ swiftType: "struct" }).convertList(themedList());
        expect(out).toContain("struct Theme {");
        expect(out).toContain("static let dark = Theme(");
    });
});
