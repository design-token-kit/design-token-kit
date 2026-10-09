import { describe, it, expect } from "vitest";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { FormatRegistry } from "#/core/formats/FormatRegistry";
import { tokenFormats } from "#/core/formats/tokenFormats";
import type { FormatDescriptor } from "#/core/formats/FormatDescriptor";
import { readDocuments, type TokenReader } from "#/core/formats/TokenReader";
import type { TokenWriter } from "#/core/formats/TokenWriter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";

const reader: TokenReader = { read: () => readDocuments([new Dtcg(new TokenGroup({}))]) };
const writer: TokenWriter = { write: () => "" };

function descriptor(
    format: TokenFormat,
    suffixes: readonly string[],
    detect: (content: string) => boolean,
): FormatDescriptor {
    return { format, suffixes, detect, createReader: async () => reader, createWriter: () => writer };
}

const DTCG = descriptor(TokenFormat.DTCG, [".dtcg.json", ".json"], (content) => content.startsWith("{"));
const DESIGN_MD = descriptor(TokenFormat.DESIGN_MD, [".design.md", ".md"], (content) => content.startsWith("---"));
const HRDT = descriptor(TokenFormat.HRDT, [".hrdt.yaml", ".hrdt.yml", ".yaml", ".yml"], () => true);

function registry(): FormatRegistry {
    return new FormatRegistry([DTCG, DESIGN_MD, HRDT]);
}

describe("FormatRegistry", () => {
    describe("lookup by format", () => {
        it("finds a registered format", () => {
            expect(registry().find(TokenFormat.DTCG)).toBe(DTCG);
        });

        it("returns undefined for a format that is not registered", () => {
            expect(new FormatRegistry([DTCG]).find(TokenFormat.HRDT)).toBeUndefined();
        });

        it("get throws for a format that is not registered, naming the readable ones", () => {
            expect(() => new FormatRegistry([DTCG]).get(TokenFormat.HRDT)).toThrow(/dtcg/);
        });
    });

    describe("detection by content", () => {
        it("detects the format whose descriptor claims the content", () => {
            expect(registry().detect("{}").format).toBe(TokenFormat.DTCG);
        });

        it("returns the first claiming descriptor in registration order", () => {
            expect(registry().detect("---\nname: x").format).toBe(TokenFormat.DESIGN_MD);
        });

        it("ignores leading whitespace", () => {
            expect(registry().detect("  \n  {}").format).toBe(TokenFormat.DTCG);
        });

        it("falls back to the last descriptor when no other claims the content", () => {
            expect(registry().detect("primitive:").format).toBe(TokenFormat.HRDT);
        });

        it("falls back for empty content", () => {
            expect(registry().detect("").format).toBe(TokenFormat.HRDT);
        });

        it("throws when the registry is empty", () => {
            expect(() => new FormatRegistry([]).detect("{}")).toThrow("The format registry is empty.");
        });
    });

    // DESIGN.md and HRDT YAML both open with `---`, so the name settles it.
    describe("detection by content and file name", () => {
        it("prefers the format the name declares when the content is ambiguous", () => {
            expect(registry().detect("---\nname: x", "tokens.yaml").format).toBe(TokenFormat.HRDT);
        });

        it("prefers the qualified suffix over the bare one", () => {
            expect(registry().detect("---\nname: x", "tokens.design.md").format).toBe(TokenFormat.DESIGN_MD);
        });

        it("ignores the name when the content is not ambiguous", () => {
            expect(registry().detect("{}", "tokens.yaml").format).toBe(TokenFormat.DTCG);
        });

        it("falls back to the content when the name declares nothing", () => {
            expect(registry().detect("---\nname: x", "tokens.css").format).toBe(TokenFormat.DESIGN_MD);
        });
    });

    describe("detection by file name", () => {
        it("matches a qualified suffix over a bare extension", () => {
            expect(registry().detectByFileName("sample.design.md")?.format).toBe(TokenFormat.DESIGN_MD);
        });

        it("matches a qualified suffix another format's extension would claim", () => {
            expect(registry().detectByFileName("sample.hrdt.yaml")?.format).toBe(TokenFormat.HRDT);
        });

        it("matches a declared extension", () => {
            expect(registry().detectByFileName("tokens.md")?.format).toBe(TokenFormat.DESIGN_MD);
        });

        it("matches any of several declared extensions", () => {
            expect(registry().detectByFileName("tokens.yml")?.format).toBe(TokenFormat.HRDT);
        });

        it("ignores extension case", () => {
            expect(registry().detectByFileName("TOKENS.JSON")?.format).toBe(TokenFormat.DTCG);
        });

        it("considers the extension, not the path", () => {
            expect(registry().detectByFileName("/md/dir/tokens.json")?.format).toBe(TokenFormat.DTCG);
        });

        it("returns undefined for an unknown extension", () => {
            expect(registry().detectByFileName("tokens.css")).toBeUndefined();
        });

        it("returns undefined for a name without an extension", () => {
            expect(registry().detectByFileName("tokens")).toBeUndefined();
        });

        it("does not mistake a trailing letter for an extension", () => {
            expect(registry().detectByFileName("README")).toBeUndefined();
        });

        it("does not mistake a dot in a directory for an extension", () => {
            expect(registry().detectByFileName("/v1.0/tokens")).toBeUndefined();
        });

        it("ignores a leading dot in a dotfile", () => {
            expect(registry().detectByFileName(".yaml")).toBeUndefined();
        });

        it("matches a name that is only one character longer than its suffix", () => {
            expect(registry().detectByFileName("a.json")?.format).toBe(TokenFormat.DTCG);
        });

        it("matches the last extension of a multi-part name", () => {
            expect(registry().detectByFileName("tokens.dark.json")?.format).toBe(TokenFormat.DTCG);
        });
    });

    describe("listing", () => {
        it("lists formats in registration order", () => {
            expect(registry().formats()).toEqual([TokenFormat.DTCG, TokenFormat.DESIGN_MD, TokenFormat.HRDT]);
        });
    });
});

describe("tokenFormats", () => {
    it("registers every readable format", () => {
        expect(tokenFormats.formats()).toEqual([TokenFormat.DTCG, TokenFormat.DESIGN_MD, TokenFormat.HRDT]);
    });
});
