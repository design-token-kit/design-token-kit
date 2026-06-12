import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const CLI_ENTRY = resolve(__dirname, "../../src/index.ts");
const CORE_TOKENS = resolve(__dirname, "../../../core/tokens");
const PROJECT_ROOT = resolve(__dirname, "../../..");

function dtokens(args: string, input?: string): { stdout: string; stderr: string; status: number } {
    const opts: Record<string, unknown> = {
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env },
        cwd: PROJECT_ROOT,
    };
    if (input !== undefined) opts.input = input;
    try {
        const output = execSync(
            `node --import tsx --conditions development ${CLI_ENTRY} ${args}`,
            opts as Parameters<typeof execSync>[1],
        );
        return { stdout: String(output), stderr: "", status: 0 };
    } catch (error: unknown) {
        const e = error as { stdout?: string; stderr?: string; status?: number };
        return {
            stdout: e.stdout ?? "",
            stderr: e.stderr ?? "",
            status: e.status ?? 1,
        };
    }
}

function fixturePath(name: string): string {
    return resolve(CORE_TOKENS, name);
}

describe("CLI", () => {
    describe("validate", () => {
        it("passes for valid DTCG JSON", () => {
            const result = dtokens(`validate ${fixturePath("valid.json")}`);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("Validation passed.");
        });

        it("passes for valid HRDT YAML", () => {
            const result = dtokens(`validate ${fixturePath("valid.yaml")}`);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain("Validation passed.");
        });

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

    describe("showcase", () => {
        it("generates HTML for valid file", () => {
            const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
            const outFile = resolve(outDir, "showcase.html");
            mkdirSync(outDir, { recursive: true });
            try {
                const result = dtokens(
                    `showcase ${fixturePath("valid.yaml")} --out ${outFile}`,
                );
                expect(result.status).toBe(0);
                expect(existsSync(outFile)).toBe(true);
                const html = readFileSync(outFile, "utf8");
                expect(html).toContain("<!DOCTYPE html>");
            } finally {
                rmSync(outDir, { recursive: true, force: true });
            }
        });

        it("fails with exit code 1 for invalid file", () => {
            const result = dtokens("showcase -", "bad content");
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("Showcase failed");
        });
    });

    describe("help", () => {
        it("shows exit codes in validate help", () => {
            const result = dtokens("validate --help");
            expect(result.stdout).toContain("Exit status:");
            expect(result.stdout).toContain("validation errors found");
        });

        it("shows exit codes in convert help", () => {
            const result = dtokens("convert --help");
            expect(result.stdout).toContain("Exit status:");
            expect(result.stdout).toContain("conversion failed");
        });

        it("shows exit codes in showcase help", () => {
            const result = dtokens("showcase --help");
            expect(result.stdout).toContain("Exit status:");
            expect(result.stdout).toContain("showcase failed");
        });
    });

    describe("exit codes", () => {
        it("returns 0 on success", () => {
            const result = dtokens(`validate ${fixturePath("valid.json")}`);
            expect(result.status).toBe(0);
        });

        it("returns 2 on validation errors", () => {
            const result = dtokens("validate -", '{"extra": true}');
            expect(result.status).toBe(2);
        });

        it("returns 1 on conversion failure", () => {
            const result = dtokens("convert - --outform css", "bad");
            expect(result.status).toBe(1);
        });
    });
});
