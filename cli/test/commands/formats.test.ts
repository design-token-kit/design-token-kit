import { describe, it, expect } from "vitest";
import { Dtcg, TokenFormat, PlatformFormat, TokenGroup, DtcgReader, DtcgList, SwiftUiTokenConverter } from "@design-token-kit/core";
import { getWriter, toDocumentFormat, validateFormatOptions } from "#commands/formats";

/** Reads a DTCG literal, failing the test when it cannot be read. */
async function read(json: object): Promise<Dtcg> {
    const result = await DtcgReader.noSchema().read(JSON.stringify(json));
    if (!result.ok) {
        expect.fail(`fixture could not be read:\n${result.issues.map((issue) => issue.message).join("\n")}`);
    }
    return result.documents[0];
}

describe("toDocumentFormat", () => {
    it("returns DTCG for 'dtcg'", async () => {
        expect(toDocumentFormat("dtcg")).toBe(TokenFormat.DTCG);
    });

    it("returns HRDT for 'hrdt'", async () => {
        expect(toDocumentFormat("hrdt")).toBe(TokenFormat.HRDT);
    });

    it("returns DESIGN_MD for 'design-md'", async () => {
        expect(toDocumentFormat("design-md")).toBe(TokenFormat.DESIGN_MD);
    });

    it("returns fallback when format is undefined", async () => {
        expect(toDocumentFormat(undefined)).toBe(TokenFormat.DTCG);
    });

    it("uses custom fallback when format is undefined", async () => {
        expect(toDocumentFormat(undefined, TokenFormat.HRDT)).toBe(TokenFormat.HRDT);
    });

    it("throws for unknown format", async () => {
        expect(() => toDocumentFormat("css")).toThrow("Unknown format \"css\"");
    });
});


describe("getWriter", () => {
    const list = new DtcgList(new Dtcg(new TokenGroup()));

    it("writes DTCG JSON", async () => {
        const writer = getWriter("dtcg");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("writes HRDT YAML", async () => {
        const writer = getWriter("hrdt");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("writes DESIGN.md", async () => {
        const writer = getWriter("design-md");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("writes CSS", async () => {
        const writer = getWriter("css");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("writes SCSS", async () => {
        const writer = getWriter("scss");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("writes TAILWIND_V4", async () => {
        const writer = getWriter("tailwind-v4");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("maps 'tailwind' to TAILWIND_V4 writer", async () => {
        const writer = getWriter("tailwind");
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("returns CSS writer and writes when format is undefined", async () => {
        const writer = getWriter();
        const out = writer.write(list, {});
        expect(typeof out).toBe("string");
    });

    it("throws for invalid format", async () => {
        expect(() => getWriter("unknown")).toThrow("Unknown format \"unknown\"");
    });

    it("writes Android resource XML output", async () => {
        const parsed = await read({ spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } });
        const out = getWriter(PlatformFormat.ANDROID).write(new DtcgList(parsed), {});
        expect(out).toContain("<resources>");
        expect(out).toContain("<dimen name=\"spacing_md\">16dp</dimen>");
    });

    it("writes SwiftUI output", async () => {
        const parsed = await read({ spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } });
        const out = getWriter(PlatformFormat.SWIFT_UI).write(new DtcgList(parsed), {});
        expect(out).toContain("enum DesignTokens {");
        expect(out).toContain("static let md: CGFloat = 16");
    });
});

describe("validateFormatOptions", () => {
    it("accepts an option for its output format", async () => {
        expect(() => validateFormatOptions("scss", { separator: "_" })).not.toThrow();
    });

    it("rejects an option for another output format", async () => {
        expect(() => validateFormatOptions("css", { swiftType: "struct" }))
            .toThrow('--swift-type is only valid for "swiftui"; got "css"');
    });

    it("accepts rem base for both supported output formats", async () => {
        expect(() => validateFormatOptions("android", { remBase: "10" })).not.toThrow();
        expect(() => validateFormatOptions("swiftui", { remBase: "10" })).not.toThrow();
    });
});

describe("SwiftUI multi-theme conversion", () => {
    async function themedList(): Promise<DtcgList> {
        const base = await read({
                color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0] } } },
            });
        const dark = await read({
                color: { primary: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1] } } },
            });
        return new DtcgList(base, new Map([["dark", dark]]));
    }

    it("emits a theme enum for the enum form", async () => {
        const out = new SwiftUiTokenConverter({ swiftType: "enum" }).convertList(await themedList());
        expect(out).toContain("enum DesignTokensDark {");
    });

    it("emits the Theme struct and a theme instance for the struct form", async () => {
        const out = new SwiftUiTokenConverter({ swiftType: "struct" }).convertList(await themedList());
        expect(out).toContain("struct Theme {");
        expect(out).toContain("static let dark = Theme(");
    });
});
