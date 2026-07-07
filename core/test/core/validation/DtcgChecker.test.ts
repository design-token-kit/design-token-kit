import { describe, it, expect } from "vitest";
import { DtcgChecker } from "#/core/validation/DtcgChecker";
import { CheckScope } from "#/core/check/CheckScope";

// Wraps a document as a `content:` source, so the checker runs straight from a
// string with no file on disk.
function source(doc: object): string {
    return "content:" + JSON.stringify({ "$schema": "", ...doc });
}

function ids(issues: { id: string }[]): string[] {
    return [...new Set(issues.map((i) => i.id))];
}

// Each document below carries exactly ONE defect, named and commented, so a
// failing check points to an obvious cause.

// Model defect: passes schema, fails model checks.
const ALIAS_TO_MISSING_TOKEN: string = source({
    primitive: { red: { "$type": "color", "$value": { colorSpace: "srgb", components: [1, 0, 0] } } },
    // bad-reference: alias target {primitive.missing} does not exist.
    broken: { "$type": "color", "$value": "{primitive.missing}" },
});

// Lint defect: passes schema and model, fails lint checks.
const LINT_VIOLATIONS: string = source({
    primitive: { color: { "$type": "color", brand: { "$value": { colorSpace: "srgb", components: [0, 0, 1] } } } },
    // raw-value-usage: only primitive may hold a raw value; semantic must alias.
    semantic: { color: { raw: { "$type": "color", "$value": { colorSpace: "srgb", components: [0, 0, 0] } } } },
    // layer-reference: component must go through semantic, not straight to primitive.
    component: { btn: { "$value": "{primitive.color.brand}" } },
});

// Lint warning: passes schema and model, reports an empty named group.
const EMPTY_GROUP: string = source({
    // empty-group: the group has no tokens or child groups.
    semantic: {},
});

// Lint warning: passes schema and model, reports a token missing $description.
const MISSING_DESCRIPTION: string = source({
    primitive: {
        // missing-description: the token has no $description.
        red: { "$type": "color", "$value": { colorSpace: "srgb", components: [1, 0, 0] } },
    },
});

// Schema defect: fails at the schema stage, before model checks run.
const SCHEMA_INVALID_COLOR: string = source({
    // schema: a color $value must be an object, not a number.
    primitive: { bad: { "$type": "color", "$value": 42 } },
});

// No defect: passes schema, model and lint.
const VALID: string = source({
    primitive: { color: { "$type": "color", brand: { "$description": "Brand color.", "$value": { colorSpace: "srgb", components: [0, 0, 1] } } } },
    semantic: { color: { action: { "$description": "Action color.", "$type": "color", "$value": "{primitive.color.brand}" } } },
});

const INVALID_TAILWIND_NAMESPACE: string = source({
    layout: {
        desktop: {
            "$type": "dimension",
            "$value": { "value": 1920, "unit": "px" },
            "$extensions": {
                "design-token-kit": {
                    "tailwindNamespace": "spacing",
                },
            },
        },
    },
});

describe("DtcgChecker", () => {
    describe("scope gating", () => {
        it("schema scope skips model checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.SCHEMA }).validate([ALIAS_TO_MISSING_TOKEN]);
            expect(issues).toEqual([]);
        });

        it("validate scope runs model checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([ALIAS_TO_MISSING_TOKEN]);
            expect(ids(issues)).toContain("bad-reference");
        });

        it("validate scope reports unsupported tailwind namespace markers as warnings", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([INVALID_TAILWIND_NAMESPACE]);
            expect(ids(issues)).toContain("bad-tailwind-namespace");
            expect(issues.find((issue) => issue.id === "bad-tailwind-namespace")?.severity).toBe("warning");
        });

        it("validate scope skips lint checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([LINT_VIOLATIONS]);
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });

        it("defaults to the validate scope", async () => {
            const issues = await new DtcgChecker().validate([LINT_VIOLATIONS]);
            expect(ids(issues)).not.toContain("layer-reference");
        });

        it("lint scope runs lint checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([LINT_VIOLATIONS]);
            expect(ids(issues)).toContain("layer-reference");
            expect(ids(issues)).toContain("raw-value-usage");
        });

        it("lint scope reports empty groups as warnings", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([EMPTY_GROUP]);
            expect(ids(issues)).toContain("empty-group");
            expect(issues.find((issue) => issue.id === "empty-group")?.severity).toBe("warning");
        });

        it("lint scope reports missing token descriptions as warnings", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([MISSING_DESCRIPTION]);
            expect(ids(issues)).toContain("missing-description");
            expect(issues.find((issue) => issue.id === "missing-description")?.severity).toBe("warning");
        });

        it("returns no issues for a valid document at lint scope", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([VALID]);
            expect(issues).toEqual([]);
        });
    });

    describe("fail-fast", () => {
        it("stops at the schema stage and skips model checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([SCHEMA_INVALID_COLOR]);
            expect(issues.every((i) => i.id === "schema")).toBe(true);
            expect(issues.length).toBeGreaterThan(0);
        });

        it("stops at the model stage and skips lint checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([ALIAS_TO_MISSING_TOKEN]);
            expect(ids(issues)).toContain("bad-reference");
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });
    });

    describe("checks allow-list", () => {
        it("runs only the listed checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT, checks: ["layer-reference"] }).validate([LINT_VIOLATIONS]);
            expect(ids(issues)).toEqual(["layer-reference"]);
        });
    });

    describe("checkSelectionWarnings", () => {
        it("returns no warnings without an allow-list", () => {
            expect(new DtcgChecker({ scope: CheckScope.VALIDATE }).checkSelectionWarnings()).toEqual([]);
        });

        it("returns no warnings for an empty allow-list", () => {
            expect(new DtcgChecker({ scope: CheckScope.VALIDATE, checks: [] }).checkSelectionWarnings()).toEqual([]);
        });

        it("warns that a lint check is inactive at the validate scope", () => {
            const warnings = new DtcgChecker({ scope: CheckScope.VALIDATE, checks: ["layer-reference"] }).checkSelectionWarnings();
            expect(warnings).toEqual([{ id: "layer-reference", problem: "inactive", requiredScope: CheckScope.LINT }]);
        });

        it("warns about an unknown check id", () => {
            const warnings = new DtcgChecker({ scope: CheckScope.LINT, checks: ["nope"] }).checkSelectionWarnings();
            expect(warnings).toEqual([{ id: "nope", problem: "unknown" }]);
        });

        it("does not warn about an active check", () => {
            const warnings = new DtcgChecker({ scope: CheckScope.LINT, checks: ["layer-reference"] }).checkSelectionWarnings();
            expect(warnings).toEqual([]);
        });

        it("treats every check as inactive at the schema scope", () => {
            const warnings = new DtcgChecker({ scope: CheckScope.SCHEMA, checks: ["bad-reference"] }).checkSelectionWarnings();
            expect(warnings).toEqual([{ id: "bad-reference", problem: "inactive", requiredScope: CheckScope.VALIDATE }]);
        });

        it("reports inactive and unknown ids together, in order", () => {
            const warnings = new DtcgChecker({ scope: CheckScope.VALIDATE, checks: ["layer-reference", "foo"] }).checkSelectionWarnings();
            expect(warnings).toEqual([
                { id: "layer-reference", problem: "inactive", requiredScope: CheckScope.LINT },
                { id: "foo", problem: "unknown" },
            ]);
        });
    });

    // One end-to-end pass: a valid document goes through the full pipeline
    // (load -> schema -> model -> lint) and comes out clean.
    describe("integration", () => {
        it("a valid document passes the whole pipeline", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([VALID]);
            expect(issues).toEqual([]);
        });
    });
});
