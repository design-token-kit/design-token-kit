import { execSync } from "node:child_process";
import { resolve } from "node:path";

export const CLI_ENTRY = resolve(__dirname, "../../src/index.ts");
export const CORE_TOKENS = resolve(__dirname, "../../../core/tokens");
export const PROJECT_ROOT = resolve(__dirname, "../../..");

export function dtokens(args: string, input?: string): { stdout: string; stderr: string; status: number } {
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

export function fixturePath(name: string): string {
    return resolve(CORE_TOKENS, name);
}
