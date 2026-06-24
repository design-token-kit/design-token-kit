import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { showcaseCommand } from "#/commands/showcase";
import { run, dtokens } from "./_run";

describe("showcase", () => {
    it("generates HTML for valid file", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", outFile);
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            const html = readFileSync(outFile, "utf8");
            expect(html).toContain("<!DOCTYPE html>");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    // Subprocess: real stdin piping cannot be faked in-process.
    describe("integration", () => {
        it("generates HTML from stdin", () => {
            const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
            const result = dtokens("showcase -", content);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("<!DOCTYPE html>");
        });

        it("fails with exit code 1 for invalid file", () => {
            const result = dtokens("showcase -", "bad content");
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("Showcase failed");
        });
    });

    it("--open requires --out", () => {
        const result = dtokens(`showcase ${resolve(__dirname, "valid.yaml")} --open`);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Showcase failed");
        expect(result.stderr).toContain("Option --open requires --out");
    });
});
