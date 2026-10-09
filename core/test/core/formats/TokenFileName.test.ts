import { describe, it, expect } from "vitest";
import { TokenFileName } from "#/core/formats/TokenFileName";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { tokenFormats } from "#/core/formats/tokenFormats";

describe("TokenFileName", () => {
    describe("format", () => {
        it("reads the format from a bare extension", () => {
            expect(TokenFileName.parse("tokens.json", tokenFormats).format).toBe(TokenFormat.DTCG);
        });

        it("reads the format from a qualified suffix", () => {
            expect(TokenFileName.parse("sample.dtcg.json", tokenFormats).format).toBe(TokenFormat.DTCG);
        });

        it("prefers the qualified suffix over the bare extension", () => {
            expect(TokenFileName.parse("sample.design.md", tokenFormats).format).toBe(TokenFormat.DESIGN_MD);
        });

        it("reads HRDT from either YAML extension", () => {
            expect(TokenFileName.parse("tokens.yaml", tokenFormats).format).toBe(TokenFormat.HRDT);
            expect(TokenFileName.parse("tokens.yml", tokenFormats).format).toBe(TokenFormat.HRDT);
        });

        it("reads the canonical DESIGN.md name", () => {
            expect(TokenFileName.parse("DESIGN.md", tokenFormats).format).toBe(TokenFormat.DESIGN_MD);
        });

        it("is undefined when no format claims the name", () => {
            expect(TokenFileName.parse("tokens.css", tokenFormats).format).toBeUndefined();
        });
    });

    describe("role", () => {
        it("is the leading segment", () => {
            expect(TokenFileName.parse("tokens.json", tokenFormats).role).toBe("tokens");
        });

        it("is the leading segment of a themed name", () => {
            expect(TokenFileName.parse("showcase.dark.dtcg.json", tokenFormats).role).toBe("showcase");
        });

        it("keeps the whole segment when no format claims the name", () => {
            expect(TokenFileName.parse("tokens.css", tokenFormats).role).toBe("tokens.css");
        });
    });

    describe("theme", () => {
        it("is undefined for a base document", () => {
            expect(TokenFileName.parse("tokens.json", tokenFormats).theme).toBeUndefined();
        });

        it("is undefined when only a format segment precedes the extension", () => {
            expect(TokenFileName.parse("sample.dtcg.json", tokenFormats).theme).toBeUndefined();
        });

        it("is the segment between the role and the extension", () => {
            expect(TokenFileName.parse("tokens.dark.json", tokenFormats).theme).toBe("dark");
        });

        it("is the segment between the role and a qualified suffix", () => {
            expect(TokenFileName.parse("showcase.dark.dtcg.json", tokenFormats).theme).toBe("dark");
        });

        it("is read past a compound DESIGN.md extension", () => {
            expect(TokenFileName.parse("sample.dark.design.md", tokenFormats).theme).toBe("dark");
        });

        // A format nobody declared is a word like any other, so it names a theme.
        it("takes an undeclared format segment as a theme", () => {
            expect(TokenFileName.parse("sample.super_dtcg.json", tokenFormats).theme).toBe("super_dtcg");
        });

        it("keeps every segment between the role and the extension", () => {
            expect(TokenFileName.parse("tokens.dark.high-contrast.json", tokenFormats).theme).toBe("dark.high-contrast");
        });

        it("is undefined when no format claims the name", () => {
            expect(TokenFileName.parse("tokens.css", tokenFormats).theme).toBeUndefined();
        });
    });

    describe("paths", () => {
        it("reads the last segment of a posix path", () => {
            const name = TokenFileName.parse("/src/styles/tokens/tokens.dark.json", tokenFormats);
            expect(name.role).toBe("tokens");
            expect(name.theme).toBe("dark");
        });

        it("reads the last segment of a windows path", () => {
            const name = TokenFileName.parse("C:\\\\styles\\\\tokens.dark.json", tokenFormats);
            expect(name.theme).toBe("dark");
        });

        it("does not mistake a dot in a directory for part of the name", () => {
            const name = TokenFileName.parse("/v1.0/tokens", tokenFormats);
            expect(name.format).toBeUndefined();
            expect(name.role).toBe("tokens");
        });
    });

    describe("real names", () => {
        it.each([
            ["tokens.json", TokenFormat.DTCG, "tokens", undefined],
            ["tokens.dark.json", TokenFormat.DTCG, "tokens", "dark"],
            ["sample.dtcg.json", TokenFormat.DTCG, "sample", undefined],
            ["sample.hrdt.yaml", TokenFormat.HRDT, "sample", undefined],
            ["sample.design.md", TokenFormat.DESIGN_MD, "sample", undefined],
            ["sample.dark.design.md", TokenFormat.DESIGN_MD, "sample", "dark"],
            ["invalid.dtcg.json", TokenFormat.DTCG, "invalid", undefined],
            ["showcase.red.dtcg.json", TokenFormat.DTCG, "showcase", "red"],
        ])("reads %s", (fileName, format, role, theme) => {
            const name = TokenFileName.parse(fileName, tokenFormats);
            expect(name.format).toBe(format);
            expect(name.role).toBe(role);
            expect(name.theme).toBe(theme);
        });
    });
});
