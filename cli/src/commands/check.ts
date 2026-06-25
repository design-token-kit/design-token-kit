import { Command, Option } from "commander";
import {
    DtcgChecker,
    listChecks,
    CheckScope,
    type CheckInfo,
    type CheckSelectionWarning,
} from "@design-token-kit/core";
import { hasErrors, printIssues } from "./issues";

const EXIT_ISSUES = 2;
const EXIT_FAILURE = 1;

interface CheckOptions {
    scope?: string;
    layers?: string;
    checks?: string;
    schema?: string;
}

export const checkCommand = new Command("check")
    .description("Check token files: schema, model correctness and architecture.")
    .argument("[files...]", "Paths to token files (reads from stdin when omitted). Supported formats: DTCG, HRDT, DESIGN.md.")
    .addOption(
        new Option("--scope <scope>", "How deep to check: schema, validate or lint. Each includes the previous.")
            .choices(CheckScope.names())
            .default(CheckScope.VALIDATE.name),
    )
    .option("--layers <names>", "Comma-separated layer order, lowest first", "primitive,semantic,component")
    .option("--checks <ids>", "Comma-separated allow-list of active check ids (default: all). See 'Available checks' below.")
    .option("--schema <version>", "DTCG JSON Schema version: 2025.10 or 2025.10-ext", "2025.10-ext")
    .addHelpText("after", formatAvailableChecks(listChecks()))
    .addHelpText("after", "\nExit status:\n  0  success\n  1  unexpected error\n  2  issues found")
    .action(async (files: string[], options: CheckOptions) => {
        try {
            const sources = files.length > 0 ? files : ["-"];
            const checker = new DtcgChecker({
                scope: CheckScope.fromName(options.scope ?? CheckScope.VALIDATE.name),
                layers: splitList(options.layers),
                checks: splitList(options.checks),
                schema: options.schema,
            });
            printSelectionWarnings(checker.checkSelectionWarnings());
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

function printSelectionWarnings(warnings: CheckSelectionWarning[]): void {
    for (const warning of warnings) {
        console.warn(formatSelectionWarning(warning));
    }
}

function formatSelectionWarning(warning: CheckSelectionWarning): string {
    if (warning.problem === "unknown") {
        return `warning: unknown check '${warning.id}'; skipped`;
    }
    return `warning: check '${warning.id}' requires --scope ${warning.requiredScope?.name}; skipped`;
}

function formatAvailableChecks(checks: CheckInfo[]): string {
    const idWidth = Math.max(...checks.map((check) => check.id.length));
    const lines = checks.map((check) => formatCheck(check, idWidth));
    return `\nAvailable checks:\n${lines.join("\n")}`;
}

function formatCheck(check: CheckInfo, idWidth: number): string {
    const id = check.id.padEnd(idWidth);
    return `  ${id}  (${check.scope.name}, ${check.severity})\n    ${check.description}`;
}

function splitList(value?: string): string[] | undefined {
    if (value === undefined) return undefined;
    const items = value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    return items.length > 0 ? items : undefined;
}
