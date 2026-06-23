import { vi } from "vitest";
import type { Command } from "commander";

/**
 * Result of running a command in-process, mirroring the shape returned by the
 * subprocess helper in {@link ./_shared}.
 */
export interface RunResult {
    stdout: string;
    stderr: string;
    status: number;
}

/**
 * Raised to unwind a command's {@code process.exit()} without terminating the
 * test runner. Caught inside {@link run}.
 */
class ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`process.exit(${code})`);
    }
}

/**
 * Runs a commander command in the current process so its code is covered.
 *
 * Captures {@code console.log} and {@code process.stdout.write} to stdout, and
 * {@code console.error}/{@code console.warn}/{@code process.stderr.write} to
 * stderr, matching how a real terminal splits the streams. Intercepts
 * {@code process.exit} and reports the code as {@link RunResult.status}
 * (0 when the command returns normally).
 *
 * Use this for command logic. For end-to-end behaviour that needs a real
 * process (argv parsing, OS exit codes, real stdin), use the subprocess helper
 * in {@link ./_shared} instead.
 */
export async function run(command: Command, ...args: string[]): Promise<RunResult> {
    const out: string[] = [];
    const err: string[] = [];
    let status = 0;
    // A real process.exit() never returns, so nothing runs after the first
    // call. We model that by latching the first exit code and ignoring any
    // output or further exits a command emits while unwinding (e.g. a catch
    // block that logs and re-exits after an inner process.exit threw).
    let exited = false;

    const log = vi.spyOn(console, "log").mockImplementation((...a) => { if (!exited) out.push(a.join(" ")); });
    const error = vi.spyOn(console, "error").mockImplementation((...a) => { if (!exited) err.push(a.join(" ")); });
    const warn = vi.spyOn(console, "warn").mockImplementation((...a) => { if (!exited) err.push(a.join(" ")); });
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => { if (!exited) out.push(String(c)); return true; }) as never);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(((c: unknown) => { if (!exited) err.push(String(c)); return true; }) as never);
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        if (!exited) {
            status = code ?? 0;
            exited = true;
        }
        throw new ExitSignal(status);
    }) as never);

    try {
        await command.parseAsync(["node", command.name(), ...args]);
    }
    catch (e) {
        if (!(e instanceof ExitSignal)) throw e;
    }
    finally {
        log.mockRestore();
        error.mockRestore();
        warn.mockRestore();
        stdout.mockRestore();
        stderr.mockRestore();
        exit.mockRestore();
    }

    return { stdout: out.join("\n"), stderr: err.join("\n"), status };
}
