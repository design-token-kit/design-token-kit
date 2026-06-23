import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateCommand } from "#/commands/validate";
import { run } from "./_run";
import { dtokens, fixturePath } from "./_shared";

describe("validate", () => {
    it("passes for valid DTCG JSON", async () => {
        const result = await run(validateCommand, fixturePath("valid.json"));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Validation passed.");
    });

    it("passes for valid HRDT YAML", async () => {
        const result = await run(validateCommand, fixturePath("valid.yaml"));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Validation passed.");
    });

    // Subprocess: real stdin piping cannot be faked in-process.
    describe("integration", () => {
        it("passes for stdin with valid content", () => {
            const content = readFileSync(fixturePath("valid.yaml"), "utf8");
            const result = dtokens("validate -", content);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("Validation passed.");
        });

        it("fails with exit code 2 for invalid file", () => {
            const result = dtokens("validate -", '{"extra": true}');
            expect(result.status).toBe(2);
        });

        it("reads from stdin when no files specified", () => {
            const content = readFileSync(fixturePath("valid.yaml"), "utf8");
            const result = dtokens("validate", content);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("Validation passed.");
        });
    });
});
