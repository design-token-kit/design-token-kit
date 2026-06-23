import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { checkCommand } from "#/commands/check";
import { run } from "./_run";
import { dtokens, fixturePath } from "./_shared";

describe("check", () => {
    it("passes for a fully valid file (default scope)", async () => {
        const result = await run(checkCommand, fixturePath("valid.json"));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Check passed.");
    });

    it("defaults to the validate scope: ignores architecture violations", async () => {
        const result = await run(checkCommand, fixturePath("arch-violation.json"));
        expect(result.status).toBe(0);
    });

    it("reports model errors with exit code 2", async () => {
        const result = await run(checkCommand, fixturePath("invalid-values.json"));
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("[bad-reference]");
    });

    describe("--scope schema", () => {
        it("passes a schema-valid but model-broken file", async () => {
            const result = await run(checkCommand, fixturePath("invalid-values.json"), "--scope", "schema");
            expect(result.status).toBe(0);
        });
    });

    describe("--scope lint", () => {
        it("reports architecture violations with exit code 2", async () => {
            const result = await run(checkCommand, fixturePath("arch-violation.json"), "--scope", "lint");
            expect(result.status).toBe(2);
            expect(result.stderr).toContain("[layer-reference]");
            expect(result.stderr).toContain("[raw-value-usage]");
        });

        it("honours the checks allow-list", async () => {
            const result = await run(checkCommand, fixturePath("arch-violation.json"), "--scope", "lint", "--checks", "layer-reference");
            expect(result.status).toBe(2);
            expect(result.stderr).toContain("[layer-reference]");
            expect(result.stderr).not.toContain("[raw-value-usage]");
        });
    });

    describe("--scope validation", () => {
        it("rejects an unknown scope with exit code 1", async () => {
            const result = await run(checkCommand, fixturePath("valid.json"), "--scope", "validation1");
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("'validation1' is invalid");
        });
    });

    describe("--checks selection warnings", () => {
        it("warns that a lint check is inactive at the default scope", async () => {
            const result = await run(checkCommand, fixturePath("arch-violation.json"), "--checks", "layer-reference");
            expect(result.status).toBe(0);
            expect(result.stderr).toContain("check 'layer-reference' requires --scope lint");
        });

        it("warns about an unknown check id", async () => {
            const result = await run(checkCommand, fixturePath("valid.json"), "--checks", "foo");
            expect(result.status).toBe(0);
            expect(result.stderr).toContain("unknown check 'foo'");
        });
    });

    // Subprocess: real stdin piping cannot be faked in-process.
    describe("integration", () => {
        it("fails a schema-invalid file from stdin", () => {
            const result = dtokens("check - --scope schema", '{"extra": true}');
            expect(result.status).toBe(2);
        });

        it("reads from stdin when no files specified", () => {
            const content = readFileSync(fixturePath("valid.yaml"), "utf8");
            const result = dtokens("check", content);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("Check passed.");
        });
    });
});
