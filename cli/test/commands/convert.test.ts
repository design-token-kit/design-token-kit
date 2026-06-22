import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dtokens, fixturePath } from "./_shared";

describe("convert", () => {
    it("converts DTCG JSON to CSS", () => {
        const result = dtokens(`convert ${fixturePath("valid.json")} --outform css`);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
        expect(result.stdout).toContain("--primitive-color-white");
    });

    it("converts HRDT YAML to CSS", () => {
        const result = dtokens(`convert ${fixturePath("valid.yaml")} --outform css`);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
        expect(result.stdout).toContain("--primitive-color-white");
    });

    it("converts from stdin", () => {
        const content = readFileSync(fixturePath("valid.yaml"), "utf8");
        const result = dtokens("convert - --outform css", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
    });

    it("fails with exit code 1 for invalid input", () => {
        const result = dtokens("convert - --outform css", "invalid content");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Conversion failed");
    });

    it("fails with exit code 1 for model-invalid input", () => {
        const result = dtokens(`convert ${fixturePath("invalid-values.json")} --outform css`);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("[bad-reference] error");
        expect(result.stderr).toContain("Conversion failed");
    });

    it("reads from stdin when no file specified", () => {
        const content = readFileSync(fixturePath("valid.yaml"), "utf8");
        const result = dtokens("convert --outform css", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
    });

    it("writes output to file when --out specified", () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "tokens.css");
        mkdirSync(outDir, { recursive: true });
        try {
            const result = dtokens(
                `convert ${fixturePath("valid.json")} --outform css --out ${outFile}`,
            );
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(readFileSync(outFile, "utf8")).toContain("--primitive-color-white");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });
});
