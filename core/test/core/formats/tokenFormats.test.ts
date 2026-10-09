import { describe, it, expect } from "vitest";
import { tokenFormats } from "#/core/formats/tokenFormats";
import { dtcgFormat } from "#/core/formats/dtcg/descriptor";
import { designMdFormat } from "#/core/formats/design-md/descriptor";
import { TokenFormat } from "#/core/formats/TokenFormat";

describe("tokenFormats", () => {
    describe("detect", () => {
        it("returns HRDT for empty content", () => {
            expect(tokenFormats.detect("").format).toBe(TokenFormat.HRDT);
        });

        it("returns HRDT for whitespace-only content", () => {
            expect(tokenFormats.detect("   \n  \t  ").format).toBe(TokenFormat.HRDT);
        });

        it("returns DTCG for JSON object", () => {
            expect(tokenFormats.detect("{}").format).toBe(TokenFormat.DTCG);
        });

        it("returns DTCG for non-empty JSON object", () => {
            expect(tokenFormats.detect('{"key": "value"}').format).toBe(TokenFormat.DTCG);
        });

        // A malformed JSON file is still a JSON file: sending it to the
        // fallback format would report a YAML error for a DTCG source.
        it("returns DTCG for content starting with { even when the JSON is broken", () => {
            expect(tokenFormats.detect("{invalid").format).toBe(TokenFormat.DTCG);
        });

        it("returns HRDT for YAML content", () => {
            const yaml = "primitive:\n  color:\n    white: \"#ffffff\"";
            expect(tokenFormats.detect(yaml).format).toBe(TokenFormat.HRDT);
        });

        it("returns DTCG over HRDT - JSON starts with {", () => {
            expect(tokenFormats.detect('{"primitive":{}}').format).toBe(TokenFormat.DTCG);
        });

        // CSS holds no tokens, so it is not a format `detect` can return; the
        // showcase asks `isCss` instead.
        it("falls back to HRDT for CSS content", () => {
            expect(tokenFormats.detect(":root { --color: red; }").format).toBe(TokenFormat.HRDT);
        });

        it("returns HRDT for BOM-prefixed content", () => {
            const content = "\uFEFFprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(tokenFormats.detect(content).format).toBe(TokenFormat.HRDT);
        });

        it("returns DESIGN_MD for content with YAML frontmatter and markdown body", () => {
            const content = "---\nname: Test\n---\n\n## Overview\n";
            expect(tokenFormats.detect(content).format).toBe(TokenFormat.DESIGN_MD);
        });

        it("returns HRDT for content starting with --- but no closing ---", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(tokenFormats.detect(content).format).toBe(TokenFormat.HRDT);
        });

        it("returns HRDT for content starting with --- with closing --- but no prose after", () => {
            const content = "---\nname: Test\n---";
            expect(tokenFormats.detect(content).format).toBe(TokenFormat.HRDT);
        });
    });

    describe("DTCG detection", () => {
        it("returns true for JSON object", () => {
            expect(dtcgFormat.detect('{"key": "value"}')).toBe(true);
        });

        it("returns true for empty JSON object", () => {
            expect(dtcgFormat.detect("{}")).toBe(true);
        });

        it("returns false for JSON array", () => {
            expect(dtcgFormat.detect("[]")).toBe(false);
        });

        it("returns false for non-JSON content", () => {
            expect(dtcgFormat.detect("primitive:")).toBe(false);
        });

        it("claims malformed JSON, leaving the syntax error to the reader", () => {
            expect(dtcgFormat.detect("{foo: bar}")).toBe(true);
        });
    });

    describe("DESIGN.md detection", () => {
        it("returns true for content with YAML frontmatter and markdown body", () => {
            expect(designMdFormat.detect("---\nname: Test\n---\n\n## Overview\nText.")).toBe(true);
        });

        it("returns false for content without --- prefix", () => {
            expect(designMdFormat.detect("name: Test\n")).toBe(false);
        });

        it("returns false for content with only opening ---", () => {
            expect(designMdFormat.detect("---\nname: Test\n")).toBe(false);
        });

        it("returns false for HRDT YAML that starts with ---", () => {
            expect(designMdFormat.detect("---\nprimitive:\n  color:\n    white: \"#ffffff\"")).toBe(false);
        });

        it("returns false for multi-doc YAML with --- separator", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"\n---\nsemantic:\n  color:\n    bg: \"{primitive.color.white}\"";
            expect(designMdFormat.detect(content)).toBe(false);
        });
    });

    describe("detection by content and file name", () => {
        it("returns DESIGN_MD for .md file with YAML frontmatter", () => {
            const content = "---\nname: Test\n---";
            expect(tokenFormats.detect(content, "DESIGN.md").format).toBe(TokenFormat.DESIGN_MD);
        });

        it("returns DESIGN_MD for .design.md file", () => {
            const content = "---\nname: Test\n---";
            expect(tokenFormats.detect(content, "tokens.design.md").format).toBe(TokenFormat.DESIGN_MD);
        });

        it("returns HRDT for .yaml file", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(tokenFormats.detect(content, "tokens.yaml").format).toBe(TokenFormat.HRDT);
        });

        it("returns HRDT for .yml file", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(tokenFormats.detect(content, "tokens.yml").format).toBe(TokenFormat.HRDT);
        });

        it("uses content detection when filename is undefined", () => {
            const content = "---\nname: Test\n---\n\n## Overview\n";
            expect(tokenFormats.detect(content).format).toBe(TokenFormat.DESIGN_MD);
        });
    });
});
