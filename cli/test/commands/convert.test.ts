import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { convertCommand } from "#/commands/convert";
import { run, dtokens } from "./_run";

describe("convert", () => {
    it("converts DTCG JSON to CSS", async () => {
        const result = await run(convertCommand, resolve(__dirname, "valid.json"), "--outform", "css");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
        expect(result.stdout).toContain("--primitive-color-white");
    });

    it("converts HRDT YAML to CSS", async () => {
        const result = await run(convertCommand, resolve(__dirname, "valid.yaml"), "--outform", "css");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":root {");
        expect(result.stdout).toContain("--primitive-color-white");
    });

    it("converts DTCG JSON to Tailwind CSS v4 theme output", async () => {
        const result = await run(convertCommand, resolve(__dirname, "valid.json"), "--outform", "tailwind-v4");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("@import 'tailwindcss';");
        expect(result.stdout).toContain("@theme {");
        expect(result.stdout).toContain("--color-primitive-white");
    });

    it("converts DTCG JSON to SCSS", async () => {
        const result = await run(convertCommand, resolve(__dirname, "valid.json"), "--outform", "scss");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("$primitive-color-white");
    });

    it("supports scss separator option", async () => {
        const result = await run(convertCommand, resolve(__dirname, "valid.json"), "--outform", "scss", "--separator", "_");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("$primitive_color_white");
    });

    it("writes one scss file per theme for multi-file conversion", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "tokens.scss");
        const baseFile = resolve(outDir, "tokens.base.scss");
        const darkFile = resolve(outDir, "tokens.dark.scss");
        mkdirSync(outDir, { recursive: true });
        try {
            const result = await run(
                convertCommand,
                resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.json"),
                resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.dark.json"),
                "--outform",
                "scss",
                "--out",
                outFile,
            );
            expect(result.status).toBe(0);
            expect(existsSync(baseFile)).toBe(true);
            expect(existsSync(darkFile)).toBe(true);
            expect(readFileSync(baseFile, "utf8")).toContain("$semantic-color-bg-surface: $primitive-color-white;");
            expect(readFileSync(darkFile, "utf8")).toContain("$semantic-color-bg-surface: $primitive-color-slate-100;");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("fails when multi-file scss conversion has no output path", async () => {
        const result = await run(
            convertCommand,
            resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.json"),
            resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.dark.json"),
            "--outform",
            "scss",
        );
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("SCSS multi-theme output requires --out because it generates multiple files");
    });

    it("supports tailwind selector options", async () => {
        const result = await run(
            convertCommand,
            resolve(__dirname, "valid.json"),
            "--outform",
            "tailwind-v4",
            "--base-selector",
            ":host",
            "--theme-selector",
            ":host([data-theme='{theme}'])",
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":host {");
    });

    it("resolves {theme} in custom tailwind theme selectors", async () => {
        const result = await run(
            convertCommand,
            resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.json"),
            resolve(__dirname, "../../../core/test/core/css/fixtures/tokens.dark.json"),
            "--outform",
            "tailwind-v4",
            "--theme-selector",
            ":host([data-theme='{theme}'])",
        );
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(":host([data-theme='dark']) {");
    });

    it("fails with exit code 1 for model-invalid input", async () => {
        const result = await run(convertCommand, resolve(__dirname, "invalid-values.json"), "--outform", "css");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("[bad-reference] error");
        expect(result.stderr).toContain("Conversion failed");
    });

    it("writes output to file when --out specified", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "tokens.css");
        mkdirSync(outDir, { recursive: true });
        try {
            const result = await run(
                convertCommand,
                resolve(__dirname, "valid.json"),
                "--outform",
                "css",
                "--out",
                outFile,
            );
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(readFileSync(outFile, "utf8")).toContain("--primitive-color-white");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    // Subprocess: real stdin piping cannot be faked in-process.
    describe("integration", () => {
        it("converts from stdin", () => {
            const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
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
            const content = readFileSync(resolve(__dirname, "valid.yaml"), "utf8");
            const result = dtokens("convert --outform css", content);
            expect(result.status).toBe(0);
            expect(result.stdout).toContain(":root {");
        });
    });
});
