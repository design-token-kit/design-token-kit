import { spawn } from "node:child_process";

/**
 * Result of running an external process.
 */
export interface ProcessResult {
    /** 
     * Standard output of the process 
     */
    stdout: string;

    /** 
     * Standard error stream of the process 
     */
    stderr: string;

    /** 
     * Process exit code (null if the process did not finish) 
     */
    exitCode: number | null;

    /** 
     * Flag that shows the process could not be started 
     */
    failedToStart: boolean;

    /** 
     * Error message when starting the process (if the process could not be started) 
     */
    startErrorMessage?: string;
}

/**
 * Runs an external process and waits for it to finish.
 * @param command - Command name to run
 * @param args - Array of command arguments
 * @returns Promise with the process result
 */
export function runProcess(command: string, args: string[]): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve) => {
        let stdout = "";
        let stderr = "";
        let failedToStart = false;
        let startErrorMessage: string | undefined;
        let childProcess: ReturnType<typeof spawn>;
        const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);

        try {
            childProcess = spawn(command, args, {
                stdio: ["ignore", "pipe", "pipe"],
                shell: useShell,
            });
        } catch (error) {
            resolve({
                stdout,
                stderr,
                exitCode: null,
                failedToStart: true,
                startErrorMessage: error instanceof Error ? error.message : String(error),
            });
            return;
        }

        childProcess.stdout?.on("data", (chunk: Buffer) => {
            stdout += chunk.toString("utf8");
        });
        childProcess.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString("utf8");
        });
        childProcess.on("error", (error: Error) => {
            failedToStart = true;
            startErrorMessage = error.message;
        });
        childProcess.on("close", (exitCode: number | null) => {
            resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode,
                failedToStart,
                startErrorMessage,
            });
        });
    });
}

