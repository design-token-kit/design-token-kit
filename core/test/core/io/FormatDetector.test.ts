import { describe, it, expect } from "vitest";
import { FormatDetector } from "#/core/io/FormatDetector";
import { Format } from "#/core/io/Format";

describe("FormatDetector", () => {
    describe("detect", () => {
        it("returns HRDT for empty content", () => {
            expect(FormatDetector.detect("")).toBe(Format.HRDT);
        });

        it("returns HRDT for whitespace-only content", () => {
            expect(FormatDetector.detect("   \n  \t  ")).toBe(Format.HRDT);
        });

        it("returns DTCG for JSON object", () => {
            expect(FormatDetector.detect("{}")).toBe(Format.DTCG);
        });

        it("returns DTCG for non-empty JSON object", () => {
            expect(FormatDetector.detect('{"key": "value"}')).toBe(Format.DTCG);
        });

        it("returns HRDT for content starting with { but invalid JSON", () => {
            expect(FormatDetector.detect("{invalid")).toBe(Format.HRDT);
        });

        it("returns HRDT for YAML content", () => {
            const yaml = "primitive:\n  color:\n    white: \"#ffffff\"";
            expect(FormatDetector.detect(yaml)).toBe(Format.HRDT);
        });

        it("returns CSS for content with :root selector", () => {
            expect(FormatDetector.detect(":root { --color: red; }")).toBe(Format.CSS);
        });

        it("returns CSS for content with custom property", () => {
            expect(FormatDetector.detect("--color: red;")).toBe(Format.CSS);
        });

        it("returns CSS for content with @layer at-rule", () => {
            expect(FormatDetector.detect("@layer base { }")).toBe(Format.CSS);
        });

        it("returns DTCG over HRDT - JSON starts with {", () => {
            expect(FormatDetector.detect('{"primitive":{}}')).toBe(Format.DTCG);
        });

        it("returns CSS over HRDT - CSS patterns take priority", () => {
            expect(FormatDetector.detect("some-value: 16px\n--color: red;")).toBe(Format.CSS);
        });

        it("returns HRDT for BOM-prefixed content", () => {
            const content = "\uFEFFprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(FormatDetector.detect(content)).toBe(Format.HRDT);
        });

        it("returns DESIGN_MD for content with YAML frontmatter and markdown body", () => {
            const content = "---\nname: Test\n---\n\n## Overview\n";
            expect(FormatDetector.detect(content)).toBe(Format.DESIGN_MD);
        });

        it("returns HRDT for content starting with --- but no closing ---", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(FormatDetector.detect(content)).toBe(Format.HRDT);
        });

        it("returns HRDT for content starting with --- with closing --- but no prose after", () => {
            const content = "---\nname: Test\n---";
            expect(FormatDetector.detect(content)).toBe(Format.HRDT);
        });
    });

    describe("isDtcg", () => {
        it("returns true for JSON object", () => {
            expect(FormatDetector.isDtcg('{"key": "value"}')).toBe(true);
        });

        it("returns true for empty JSON object", () => {
            expect(FormatDetector.isDtcg("{}")).toBe(true);
        });

        it("returns false for JSON array", () => {
            expect(FormatDetector.isDtcg("[]")).toBe(false);
        });

        it("returns false for non-JSON content", () => {
            expect(FormatDetector.isDtcg("primitive:")).toBe(false);
        });

        it("returns false for malformed JSON", () => {
            expect(FormatDetector.isDtcg("{foo: bar}")).toBe(false);
        });
    });

    describe("isCss", () => {
        it("returns true for :root selector", () => {
            expect(FormatDetector.isCss(":root { --main: #fff; }")).toBe(true);
        });

        it("returns true for :root with spaces before", () => {
            expect(FormatDetector.isCss("  :root {\n    --main: #fff;\n  }")).toBe(true);
        });

        it("returns true for custom property declaration", () => {
            expect(FormatDetector.isCss("--main-color: #ff0000;")).toBe(true);
        });

        it("returns true for custom property with spaces", () => {
            expect(FormatDetector.isCss("  --spacing-md: 16px;")).toBe(true);
        });

        it("returns true for @layer at-rule", () => {
            expect(FormatDetector.isCss("@layer base {\n  html { }\n}")).toBe(true);
        });

        it("returns false for non-CSS content", () => {
            expect(FormatDetector.isCss("primitive:\n  color:\n    white: '#fff'")).toBe(false);
        });

        it("returns false for JSON content", () => {
            expect(FormatDetector.isCss('{"key": "value"}')).toBe(false);
        });
    });

    describe("isDesignMd", () => {
        it("returns true for content with YAML frontmatter and markdown body", () => {
            expect(FormatDetector.isDesignMd("---\nname: Test\n---\n\n## Overview\nText.")).toBe(true);
        });

        it("returns false for content without --- prefix", () => {
            expect(FormatDetector.isDesignMd("name: Test\n")).toBe(false);
        });

        it("returns false for content with only opening ---", () => {
            expect(FormatDetector.isDesignMd("---\nname: Test\n")).toBe(false);
        });

        it("returns false for HRDT YAML that starts with ---", () => {
            expect(FormatDetector.isDesignMd("---\nprimitive:\n  color:\n    white: \"#ffffff\"")).toBe(false);
        });

        it("returns false for multi-doc YAML with --- separator", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"\n---\nsemantic:\n  color:\n    bg: \"{primitive.color.white}\"";
            expect(FormatDetector.isDesignMd(content)).toBe(false);
        });
    });

    describe("detectWithContentAndFilename", () => {
        it("returns DESIGN_MD for .md file with YAML frontmatter", () => {
            const content = "---\nname: Test\n---";
            expect(FormatDetector.detectWithContentAndFilename(content, "DESIGN.md")).toBe(Format.DESIGN_MD);
        });

        it("returns DESIGN_MD for .design.md file", () => {
            const content = "---\nname: Test\n---";
            expect(FormatDetector.detectWithContentAndFilename(content, "tokens.design.md")).toBe(Format.DESIGN_MD);
        });

        it("returns HRDT for .yaml file", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(FormatDetector.detectWithContentAndFilename(content, "tokens.yaml")).toBe(Format.HRDT);
        });

        it("returns HRDT for .yml file", () => {
            const content = "---\nprimitive:\n  color:\n    white: \"#ffffff\"";
            expect(FormatDetector.detectWithContentAndFilename(content, "tokens.yml")).toBe(Format.HRDT);
        });

        it("uses content detection when filename is undefined", () => {
            const content = "---\nname: Test\n---\n\n## Overview\n";
            expect(FormatDetector.detectWithContentAndFilename(content)).toBe(Format.DESIGN_MD);
        });
    });
});
