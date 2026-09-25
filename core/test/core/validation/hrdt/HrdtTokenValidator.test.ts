import { describe, expect, it } from "vitest";
import { HrdtTokenValidator } from "#/core/validation/hrdt/HrdtTokenValidator";

function source(yaml: string): string {
    return `content:${yaml}`;
}

function ids(issues: { id: string }[]): string[] {
    return [...new Set(issues.map((i) => i.id))];
}

const VALID = source(`
primitive:
  color:
    white: "#ffffff"
semantic:
  color:
    bg: "{primitive.color.white}"
`);

const INVALID_COLOR = source(`
primitive:
  color:
    bad: "not-a-color"
`);

const INVALID_DIMENSION = source(`
primitive:
  dimension:
    gap: 12em
`);

describe("HrdtTokenValidator", () => {
    describe("valid documents", () => {
        it("passes a valid HRDT document", async () => {
            const issues = await new HrdtTokenValidator().validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("passes nested color palette steps", async () => {
            const issues = await new HrdtTokenValidator().validate([source(`
primitive:
  color:
    brand:
      500: "#2549f6"
semantic:
  color:
    action-primary: "{primitive.color.brand.500}"
`)]);

            expect(issues).toEqual([]);
        });
    });

    describe("schema errors", () => {
        it("detects an invalid color value", async () => {
            const issues = await new HrdtTokenValidator().validate([INVALID_COLOR]);
            expect(issues.length).toBeGreaterThan(0);
            expect(ids(issues)).toContain("schema");
        });

        it("detects an invalid dimension value", async () => {
            const issues = await new HrdtTokenValidator().validate([INVALID_DIMENSION]);
            expect(issues.length).toBeGreaterThan(0);
            expect(ids(issues)).toContain("schema");
        });

        it("reports a YAML syntax error as an issue", async () => {
            const issues = await new HrdtTokenValidator().validate([source("primitive:\n  color: [1, 2\n")]);
            expect(issues).toEqual([
                expect.objectContaining({ id: "schema", severity: "error" }),
            ]);
        });
    });

    describe("multi-document sources", () => {
        it("passes a base document followed by a theme", async () => {
            const issues = await new HrdtTokenValidator().validate([source(`
primitive:
  color:
    white: "#ffffff"
---
primitive:
  color:
    white: "#000000"
`)]);
            expect(issues).toEqual([]);
        });

        it("names the document that fails validation", async () => {
            const issues = await new HrdtTokenValidator().validate([source(`
primitive:
  color:
    white: "#ffffff"
---
primitive:
  color:
    bad: "not-a-color"
`)]);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.every((issue) => issue.message.startsWith("document 2 "))).toBe(true);
        });
    });

    describe("issue structure", () => {
        it("includes severity, sourcePath and raw AJV details", async () => {
            const issues = await new HrdtTokenValidator().validate([INVALID_COLOR]);

            for (const issue of issues) {
                expect(issue.id).toBe("schema");
                expect(issue.severity).toBe("error");
                expect(issue.sourcePath).toBe(INVALID_COLOR);
                expect(typeof issue.message).toBe("string");
                expect(issue.message.length).toBeGreaterThan(0);
                expect(issue.raw).toBeDefined();
            }
        });
    });
});
