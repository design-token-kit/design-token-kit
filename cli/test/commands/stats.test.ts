import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { dtokens } from "./_run";

describe("stats", () => {
    it("prints text stats by default", () => {
        const result = dtokens(`stats ${resolve(__dirname, "valid.yaml")}`);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Total tokens:      1");
        expect(result.stdout).toContain("Referenced tokens: 0 - 0.0%");
        expect(result.stdout).toContain("Direct values:     1 - 100.0%");
        expect(result.stdout).not.toContain("Groups:");
    });

    it("reads from stdin and prints text stats", () => {
        const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
        const result = dtokens("stats -", content);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Total tokens:      1");
        expect(result.stdout).toContain("Referenced tokens: 0 - 0.0%");
        expect(result.stdout).toContain("Direct values:     1 - 100.0%");
        expect(result.stdout).not.toContain("Groups:");
    });

    it("writes HTML report to custom path", () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });

        try {
            const result = dtokens(`stats ${resolve(__dirname, "valid.yaml")} --out ${outFile}`);
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(result.stdout).toContain(`Saved HTML to: ${outFile}`);
            const html = readFileSync(outFile, "utf8");
            expect(html).toContain("<!DOCTYPE html>");
            expect(html).toContain("Design Tokens - Statistics");
            expect(html).toContain('stats-card__value">1</div>');
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
        const result = dtokens(`stats ${resolve(__dirname, "valid.yaml")} --open`);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Stats failed");
        expect(result.stderr).toContain("Option --open requires --out");
    });
});
