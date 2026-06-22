import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { DtcgChecker } from "#/core/validation/DtcgChecker";
import { CheckScope } from "#/core/check/CheckScope";

function fixture(name: string): string {
    return resolve(__dirname, "../../../tokens", name);
}

const VALID = fixture("valid.json");
const INVALID_SCHEMA = fixture("invalid-schema.json");
const INVALID_VALUES = fixture("invalid-values.json");
const ARCH_VIOLATION = fixture("arch-violation.json");

function ids(issues: { id: string }[]): string[] {
    return [...new Set(issues.map((i) => i.id))];
}

describe("DtcgChecker", () => {
    describe("scope: schema", () => {
        it("returns no issues for a schema-valid file", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.SCHEMA }).validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("reports schema issues for a schema-invalid file", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.SCHEMA }).validate([INVALID_SCHEMA]);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.some((i) => i.id === "schema")).toBe(true);
        });

        it("does not run model checks, even when the model is broken", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.SCHEMA }).validate([INVALID_VALUES]);
            expect(issues).toEqual([]);
        });
    });

    describe("scope: validate", () => {
        it("reports model issues for a schema-valid but model-broken file", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([INVALID_VALUES]);
            expect(ids(issues)).toContain("bad-reference");
        });

        it("does not run architecture checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([ARCH_VIOLATION]);
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });

        it("returns no issues for a fully valid file", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("defaults to the validate scope", async () => {
            const issues = await new DtcgChecker().validate([ARCH_VIOLATION]);
            expect(ids(issues)).not.toContain("layer-reference");
        });
    });

    describe("scope: lint", () => {
        it("reports architecture issues on top of model checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([ARCH_VIOLATION]);
            expect(ids(issues)).toContain("layer-reference");
            expect(ids(issues)).toContain("raw-value-usage");
        });

        it("returns no issues for a fully valid file", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([VALID]);
            expect(issues).toEqual([]);
        });
    });

    describe("fail-fast", () => {
        it("stops at the schema stage and skips model checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([INVALID_SCHEMA]);
            expect(issues.every((i) => i.id === "schema")).toBe(true);
        });

        it("stops at the model stage and skips architecture checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT }).validate([INVALID_VALUES]);
            expect(ids(issues)).toContain("bad-reference");
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });
    });

    describe("checks allow-list", () => {
        it("runs only the listed checks", async () => {
            const issues = await new DtcgChecker({ scope: CheckScope.LINT, checks: ["layer-reference"] }).validate([ARCH_VIOLATION]);
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
});
