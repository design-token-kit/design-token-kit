import { Command } from "commander";
import { DtcgChecker, type CheckScope } from "@design-token-kit/core";
import { hasErrors, printIssues } from "./issues";

const EXIT_ISSUES = 2;
const EXIT_FAILURE = 1;

interface CheckOptions {
    scope?: string;
    layers?: string;
    checks?: string;
}

export const checkCommand = new Command("check")
    .description("Check token files: schema, model correctness and architecture.")
    .argument("[files...]", "Paths to token files (reads from stdin when omitted). Supported formats: DTCG, HRDT.")
    .option("--scope <scope>", "How deep to check: schema, validate or lint. Each includes the previous.", "validate")
    .option("--layers <names>", "Comma-separated layer order, lowest first", "primitive,semantic,component")
    .option("--checks <ids>", "Comma-separated allow-list of active check ids (default: all)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  unexpected error\n  2  issues found")
    .action(async (files: string[], options: CheckOptions) => {
        try {
            const sources = files.length > 0 ? files : ["-"];
            const checker = new DtcgChecker({
                scope: options.scope as CheckScope,
                layers: splitList(options.layers),
                checks: splitList(options.checks),
            });
            const issues = await checker.validate(sources);
            printIssues(issues);
            if (hasErrors(issues)) {
                process.exit(EXIT_ISSUES);
            }
            console.log("Check passed.");
        }
        catch (error) {
            console.error("Check failed:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

function splitList(value?: string): string[] | undefined {
    if (value === undefined) return undefined;
    const items = value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    return items.length > 0 ? items : undefined;
}
