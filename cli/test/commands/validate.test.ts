import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dtokens } from "./_run";

// "validate" is a commander alias for "check" (see check.ts); argv parsing
// and alias resolution only happen in a real process, so these are
// subprocess integration tests rather than in-process command tests.
describe("validate (alias for check)", () => {
    it("passes for valid DTCG JSON", () => {
        const result = dtokens(["validate", resolve(__dirname, "valid.json")]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Check passed.");
    });

    it("passes for valid HRDT YAML", () => {
        const result = dtokens(["validate", resolve(__dirname, "valid.yaml")]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Check passed.");
    });

    it("passes for stdin with valid content", () => {
        const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
        const result = dtokens("validate -", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Check passed.");
    });

    it("fails with exit code 2 for invalid file", () => {
        const result = dtokens("validate -", '{"extra": true}');
        expect(result.status).toBe(2);
    });

    it("reads from stdin when no files specified", () => {
        const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
        const result = dtokens("validate", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Check passed.");
    });

    it("does not print a deprecation warning", () => {
        const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
        const result = dtokens("validate", content);
        expect(result.stderr).not.toContain("deprecated");
    });
});
