import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dtokens, fixturePath } from "./_shared";

describe("stats", () => {
    it("prints text stats by default", () => {
        const result = dtokens(`stats ${fixturePath("valid.yaml")}`);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Total tokens:      151");
        expect(result.stdout).toContain("Referenced tokens: 88 - 58.3%");
        expect(result.stdout).toContain("Direct values:     63 - 41.7%");
        expect(result.stdout).not.toContain("Groups:");
    });

    it("reads from stdin and prints text stats", () => {
        const content = readFileSync(fixturePath("valid.yaml"), "utf8");
        const result = dtokens("stats -", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Total tokens:      151");
        expect(result.stdout).toContain("Referenced tokens: 88 - 58.3%");
        expect(result.stdout).toContain("Direct values:     63 - 41.7%");
        expect(result.stdout).not.toContain("Groups:");
    });

    it("writes HTML report to custom path", () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });

        try {
            const result = dtokens(`stats ${fixturePath("valid.yaml")} --out ${outFile}`);
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(result.stdout).toContain(`Saved HTML to: ${outFile}`);
            const html = readFileSync(outFile, "utf8");
            expect(html).toContain("<!DOCTYPE html>");
            expect(html).toContain("Design Tokens - stats");
            expect(html).toContain(">151<");
            expect(html).not.toContain(">Groups<");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("fails for invalid input", () => {
        const result = dtokens("stats -", "bad content");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Stats failed");
    });

    it("--open requires --out", () => {
        const result = dtokens(`stats ${fixturePath("valid.yaml")} --open`);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Stats failed");
        expect(result.stderr).toContain("Option --open requires --out");
    });
});
