import { describe, it, expect } from "vitest";
import { runProcess } from "#/utils/processRunner";

describe("runProcess", () => {
    describe("successful process", () => {
        it("captures stdout", async () => {
            const result = await runProcess("node", ["-e", "process.stdout.write('hello')"]);
            expect(result.stdout).toBe("hello");
        });

        it("captures stderr", async () => {
            const result = await runProcess("node", ["-e", "process.stderr.write('err')"]);
            expect(result.stderr).toBe("err");
        });

        it("returns exit code 0 on success", async () => {
            const result = await runProcess("node", ["-e", "process.exit(0)"]);
            expect(result.exitCode).toBe(0);
        });

        it("returns non-zero exit code on failure", async () => {
            const result = await runProcess("node", ["-e", "process.exit(42)"]);
            expect(result.exitCode).toBe(42);
        });

        it("sets failedToStart to false on successful spawn", async () => {
            const result = await runProcess("node", ["-e", ""]);
            expect(result.failedToStart).toBe(false);
        });

        it("trims trailing whitespace from stdout", async () => {
            const result = await runProcess("node", ["-e", "process.stdout.write('line\\n')"]);
            expect(result.stdout).toBe("line");
        });

        it("trims trailing whitespace from stderr", async () => {
            const result = await runProcess("node", ["-e", "process.stderr.write('err\\n')"]);
            expect(result.stderr).toBe("err");
        });

        it("captures multi-line stdout as single string", async () => {
            const result = await runProcess("node", ["-e", "console.log('a'); console.log('b')"]);
            expect(result.stdout).toBe("a\nb");
        });

        it("startErrorMessage is undefined when process starts successfully", async () => {
            const result = await runProcess("node", ["-e", ""]);
            expect(result.startErrorMessage).toBeUndefined();
        });
    });

    describe("failed to start", () => {
        it("sets failedToStart to true for nonexistent command", async () => {
            const result = await runProcess("__nonexistent_command__", []);
            expect(result.failedToStart).toBe(true);
        });

        it("does not return exit code 0 when process fails to start", async () => {
            const result = await runProcess("__nonexistent_command__", []);
            expect(result.exitCode).not.toBe(0);
        });

        it("provides startErrorMessage when process fails to start", async () => {
            const result = await runProcess("__nonexistent_command__", []);
            expect(result.startErrorMessage).toBeDefined();
            expect(typeof result.startErrorMessage).toBe("string");
        });

        it("returns empty stdout when process fails to start", async () => {
            const result = await runProcess("__nonexistent_command__", []);
            expect(result.stdout).toBe("");
        });

        it("returns empty stderr when process fails to start", async () => {
            const result = await runProcess("__nonexistent_command__", []);
            expect(result.stderr).toBe("");
        });
    });
});
