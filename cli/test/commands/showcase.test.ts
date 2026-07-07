import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { showcaseCommand } from "#/commands/showcase";
import { run, dtokens } from "./_run";

vi.mock("node:child_process", async () => {
    const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
    return {
        ...actual,
        spawn: vi.fn(),
    };
});

describe("showcase", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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

    it("prints HTML to stdout when no out is provided", async () => {
        const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"));
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("<!DOCTYPE html>");
    });

    it("reads from stdin when no files are provided", async () => {
        const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
        Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

        try {
            const result = await run(showcaseCommand);
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("Showcase failed");
        } finally {
            if (original === undefined) {
                Reflect.deleteProperty(process.stdin, "isTTY");
            } else {
                Object.defineProperty(process.stdin, "isTTY", original);
            }
        }
    });

    it("writes HTML to a relative out file in tmpdir", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        const originalTemp = process.env.TEMP;
        const originalTmp = process.env.TMP;
        process.env.TEMP = outDir;
        process.env.TMP = outDir;

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", "showcase.html");
            expect(result.status).toBe(0);
            expect(existsSync(outFile)).toBe(true);
            expect(result.stdout).toContain(`Saved HTML to: ${outFile}`);
        } finally {
            process.env.TEMP = originalTemp;
            process.env.TMP = originalTmp;
            rmSync(outDir, { recursive: true, force: true });
        }
    });

    it("writes HTML to a nested relative out path", async () => {
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        const nestedDir = resolve(outDir, "nested");
        const outFile = resolve(nestedDir, "showcase.html");
        mkdirSync(nestedDir, { recursive: true });
        const originalCwd = process.cwd();
        process.chdir(outDir);

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", "nested/showcase.html");
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
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        const { spawn } = await import("node:child_process");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
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
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
        const { spawn } = await import("node:child_process");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
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
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("win32");
        const { spawn } = await import("node:child_process");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
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
        const outFile = resolve(outDir, "showcase.html");
        mkdirSync(outDir, { recursive: true });
        const platform = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        const { spawn } = await import("node:child_process");
        const spawnMock = vi.mocked(spawn);
        spawnMock.mockReturnValue({} as never);

        try {
            const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--out", outFile, "--open");
            expect(result.status).toBe(0);
            expect(platform).toHaveBeenCalled();
            expect(spawnMock).toHaveBeenCalledWith("xdg-open", [outFile], expect.any(Object));
        } finally {
            spawnMock.mockReset();
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

    it("fails in-process when --open is used without --out", async () => {
        const result = await run(showcaseCommand, resolve(__dirname, "valid.yaml"), "--open");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Showcase failed");
        expect(result.stderr).toContain("Option --open requires --out");
    });
});
