import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import process from "node:process";
import { statsCommand } from "#/commands/stats";
import { run } from "./_run";
import { dtokens } from "./_run";

vi.mock("node:child_process", async () => {
    const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    return {
        ...actual,
        spawn: vi.fn(),
    };
});

describe("stats", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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

    it("prints stats to stdout when no out is provided", async () => {
        const result = await run(statsCommand, resolve(__dirname, "valid.yaml"));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Total tokens:      1");
    });

    it("fails in-process when no files are provided", async () => {
        const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

        try {
            const result = await run(statsCommand);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("Stats failed");
        } finally {
            if (original === undefined) {
                delete (process.stdin as typeof process.stdin & { isTTY?: boolean }).isTTY;
            } else {
                Object.defineProperty(process.stdin, "isTTY", original);
            }
        }
    });

    it("writes HTML to a relative out file in cwd", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(outDir);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", "stats.html");
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(result.stdout).toContain(`Saved HTML to: ${outFile}`);
        } finally {
            process.chdir(originalCwd);
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("writes HTML to a nested relative out path", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const nestedDir = resolve(outDir, "nested");
        const outFile = resolve(nestedDir, "stats.html");
        mkdirSync(nestedDir, { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(outDir);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", "nested/stats.html");
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(result.stdout).toContain("Saved HTML to: nested");
        } finally {
            process.chdir(originalCwd);
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("opens the generated HTML when --open is set", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
            expect(result.status).toBe(0);
            expect(spawnMock).toHaveBeenCalled();
            expect(result.stdout).toContain(`Saved HTML to: ${outFile}`);
        } finally {
            spawnMock.mockReset();
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("opens on macOS with the open command", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
            expect(result.status).toBe(0);
            expect(platform).toHaveBeenCalled();
            expect(spawnMock).toHaveBeenCalledWith("open", [outFile], expect.any(Object));
        } finally {
            spawnMock.mockReset();
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("opens on Windows with cmd start", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
            expect(result.status).toBe(0);
            expect(platform).toHaveBeenCalled();
            expect(spawnMock).toHaveBeenCalledWith("cmd", ["/c", "start", "", outFile], expect.any(Object));
        } finally {
            spawnMock.mockReset();
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("opens on Linux with xdg-open", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "stats.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
            expect(result.status).toBe(0);
            expect(platform).toHaveBeenCalled();
            expect(spawnMock).toHaveBeenCalledWith("xdg-open", [outFile], expect.any(Object));
        } finally {
            spawnMock.mockReset();
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

    it("fails in-process when --open is used without --out", async () => {
        const result = await run(statsCommand, resolve(__dirname, "valid.yaml"), "--open");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Stats failed");
        expect(result.stderr).toContain("Option --open requires --out");
    });
});
