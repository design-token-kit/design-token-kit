import { describe, it, expect } from "vitest";
import { DesignMdTokenValidator } from "#/core/validation/design-md/DesignMdTokenValidator";

function yamlValue(value: unknown): string {
    if (typeof value === "string") {
        if (/^#|^\{|^\-|[:{}\[\],&\*\?!|>@]/.test(value) || value.includes(" ") || value.includes("#")) {
            return `"${value}"`;
        }
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return String(value);
}

function indentYaml(obj: Record<string, unknown>, depth: number): string {
    const indent = "  ".repeat(depth);
    return Object.entries(obj)
        .map(([key, value]) => {
            if (typeof value === "object" && value !== null) {
                return `${indent}${key}:\n${indentYaml(value as Record<string, unknown>, depth + 1)}`;
            }
            return `${indent}${key}: ${yamlValue(value)}`;
        })
        .join("\n");
}

function source(frontmatter: Record<string, unknown>, prose = "## Overview\n"): string {
    const yaml = indentYaml(frontmatter, 0);
    return "content:" + `---\n${yaml}\n---\n\n${prose}`;
}

function ids(issues: { id: string }[]): string[] {
    return [...new Set(issues.map((i) => i.id))];
}

const VALID = source({
    name: "Heritage",
    version: "alpha",
    colors: { primary: "#1A1C1E", secondary: "#6C7278" },
    typography: { h1: { fontFamily: "Public Sans", fontSize: "48px", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" } },
    rounded: { sm: "4px" },
    spacing: { md: "16px" },
    components: { "button-primary": { backgroundColor: "{colors.primary}", textColor: "#ffffff", rounded: "{rounded.sm}", padding: "12px" } },
});

// Schema defect: unknown top-level key.
const UNKNOWN_TOP_KEY = source({
    name: "Test",
    colours: { primary: "#fff" },
});

// Schema defect: invalid typography value (string instead of object).
const SCHEMA_INVALID_TYPO = source({
    typography: { h1: "not-an-object" },
});

// Schema defect: name missing (optional — passes).
// Schema defect: extra keys in typography object (not allowed).
const SCHEMA_EXTRA_TYPO_KEY = source({
    typography: { h1: { fontFamily: "Arial", unknownExtra: "value" } },
});

// Schema defect: unknown component property (allowed by schema, no error).
const UNKNOWN_COMPONENT_PROP = source({
    name: "Test",
    components: { btn: { borderColor: "#ff0000" } },
});

// Edge case: name with special characters needs quoting.
const NAME_WITH_SPECIAL_CHARS = source({
    name: "Design: Heritage",
    colors: { primary: "#1A1C1E" },
});

// Minimal valid: just colors.
const MINIMAL_COLORS = source({
    colors: { primary: "#1A1C1E" },
});

// Minimal valid: just name and colors.
const NAME_AND_COLORS = source({
    name: "Test",
    colors: { primary: "#1A1C1E" },
});

describe("DesignMdTokenValidator", () => {
    describe("valid documents", () => {
        it("passes a complete valid DESIGN.md", async () => {
            const issues = await new DesignMdTokenValidator().validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("passes minimal colors-only document", async () => {
            const issues = await new DesignMdTokenValidator().validate([MINIMAL_COLORS]);
            expect(issues).toEqual([]);
        });

        it("passes name and colors document", async () => {
            const issues = await new DesignMdTokenValidator().validate([NAME_AND_COLORS]);
            expect(issues).toEqual([]);
        });

        it("passes document with spec-compliant dimension units", async () => {
            const src = source({ rounded: { sm: "4px", md: "8em", lg: "16rem" } });
            const issues = await new DesignMdTokenValidator().validate([src]);
            expect(issues).toEqual([]);
        });
    });

    describe("schema errors", () => {
        it("detects unknown top-level key", async () => {
            const issues = await new DesignMdTokenValidator().validate([UNKNOWN_TOP_KEY]);
            expect(issues.length).toBeGreaterThan(0);
            expect(ids(issues)).toContain("schema");
        });

        it("detects invalid typography value type", async () => {
            const issues = await new DesignMdTokenValidator().validate([SCHEMA_INVALID_TYPO]);
            expect(issues.length).toBeGreaterThan(0);
        });

        it("detects extra key in typography object", async () => {
            const issues = await new DesignMdTokenValidator().validate([SCHEMA_EXTRA_TYPO_KEY]);
            expect(issues.length).toBeGreaterThan(0);
        });

        it("passes name with special characters", async () => {
            const issues = await new DesignMdTokenValidator().validate([NAME_WITH_SPECIAL_CHARS]);
            expect(issues).toEqual([]);
        });

        it("passes unknown component property with valid value", async () => {
            const issues = await new DesignMdTokenValidator().validate([UNKNOWN_COMPONENT_PROP]);
            expect(issues).toEqual([]);
        });
    });

    describe("issue structure", () => {
        it("issues have correct severity and id", async () => {
            const issues = await new DesignMdTokenValidator().validate([UNKNOWN_TOP_KEY]);
            for (const issue of issues) {
                expect(issue.id).toBe("schema");
                expect(issue.severity).toBe("error");
                expect(typeof issue.message).toBe("string");
                expect(issue.message.length).toBeGreaterThan(0);
            }
        });

        it("includes sourcePath in issues", async () => {
            const issues = await new DesignMdTokenValidator().validate([UNKNOWN_TOP_KEY]);
            for (const issue of issues) {
                expect(typeof issue.sourcePath).toBe("string");
            }
        });

        it("includes raw AJV error object", async () => {
            const issues = await new DesignMdTokenValidator().validate([UNKNOWN_TOP_KEY]);
            for (const issue of issues) {
                expect(issue.raw).toBeDefined();
            }
        });
    });
});
