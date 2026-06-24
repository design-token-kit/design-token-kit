import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { vi } from "vitest";
import type { Command } from "commander";

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
 * process (argv parsing, OS exit codes, real stdin), use {@link dtokens}
 * instead.
 */
export async function run(command: Command, ...args: string[]): Promise<RunResult> {
    const out: string[] = [];
    const err: string[] = [];
    let status = 0;
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

/**
 * Result of running a command, shared by both {@link run} (in-process)
 * and {@link dtokens} (subprocess).
 */
export interface RunResult {
    stdout: string;
    stderr: string;
    status: number;
}

/**
 * Runs the CLI entry point in a subprocess.
 *
 * Use this for tests that need a real process: argv parsing, OS exit codes,
 * real stdin piping. For command logic that can be tested in-process,
 * use {@link run} instead.
 *
 * @param args  Single string (split on whitespace) or pre-split array.
 * @param input Text to pipe to stdin.
 */
export function dtokens(args: string | string[], input?: string): RunResult {
    const argv = typeof args === "string" ? args.split(/\s+/).filter(Boolean) : args;
    const result = spawnSync(
        "node",
        ["--import", "tsx", "--conditions", "development", CLI_ENTRY, ...argv],
        {
            cwd: resolve(__dirname, "../../.."),
            encoding: "utf8",
            env: { ...process.env },
            input,
        },
    );
    return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        status: result.status ?? 1,
    };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const CLI_ENTRY = resolve(__dirname, "../../src/index.ts");

/**
 * Raised to unwind a command's {@code process.exit()} without terminating the
 * test runner. Caught inside {@link run}.
 *
 * A real {@code process.exit()} never returns, so we throw this signal to
 * unwind the stack. Nothing after the first exit call runs (modelled by
 * the {@code exited} latch in {@link run}).
 */
class ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`process.exit(${code})`);
    }
}
