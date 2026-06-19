import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { DtcgChecker } from "#/core/validation/DtcgChecker";

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
            const issues = await new DtcgChecker({ scope: "schema" }).validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("reports schema issues for a schema-invalid file", async () => {
            const issues = await new DtcgChecker({ scope: "schema" }).validate([INVALID_SCHEMA]);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.some((i) => i.id === "schema")).toBe(true);
        });

        it("does not run model checks, even when the model is broken", async () => {
            const issues = await new DtcgChecker({ scope: "schema" }).validate([INVALID_VALUES]);
            expect(issues).toEqual([]);
        });
    });

    describe("scope: validate", () => {
        it("reports model issues for a schema-valid but model-broken file", async () => {
            const issues = await new DtcgChecker({ scope: "validate" }).validate([INVALID_VALUES]);
            expect(ids(issues)).toContain("bad-reference");
        });

        it("does not run architecture checks", async () => {
            const issues = await new DtcgChecker({ scope: "validate" }).validate([ARCH_VIOLATION]);
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });

        it("returns no issues for a fully valid file", async () => {
            const issues = await new DtcgChecker({ scope: "validate" }).validate([VALID]);
            expect(issues).toEqual([]);
        });

        it("defaults to the validate scope", async () => {
            const issues = await new DtcgChecker().validate([ARCH_VIOLATION]);
            expect(ids(issues)).not.toContain("layer-reference");
        });
    });

    describe("scope: lint", () => {
        it("reports architecture issues on top of model checks", async () => {
            const issues = await new DtcgChecker({ scope: "lint" }).validate([ARCH_VIOLATION]);
            expect(ids(issues)).toContain("layer-reference");
            expect(ids(issues)).toContain("raw-value-usage");
        });

        it("returns no issues for a fully valid file", async () => {
            const issues = await new DtcgChecker({ scope: "lint" }).validate([VALID]);
            expect(issues).toEqual([]);
        });
    });

    describe("fail-fast", () => {
        it("stops at the schema stage and skips model checks", async () => {
            const issues = await new DtcgChecker({ scope: "lint" }).validate([INVALID_SCHEMA]);
            expect(issues.every((i) => i.id === "schema")).toBe(true);
        });

        it("stops at the model stage and skips architecture checks", async () => {
            const issues = await new DtcgChecker({ scope: "lint" }).validate([INVALID_VALUES]);
            expect(ids(issues)).toContain("bad-reference");
            expect(ids(issues)).not.toContain("layer-reference");
            expect(ids(issues)).not.toContain("raw-value-usage");
        });
    });

    describe("checks allow-list", () => {
        it("runs only the listed checks", async () => {
            const issues = await new DtcgChecker({ scope: "lint", checks: ["layer-reference"] }).validate([ARCH_VIOLATION]);
            expect(ids(issues)).toEqual(["layer-reference"]);
        });
    });
});
