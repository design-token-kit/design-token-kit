import { Command } from "commander";
import {
    DtcgTokenValidator,
    type ValidationIssue,
} from "@design-token-kit/core";

const EXIT_VALIDATION_ERROR = 2;
const EXIT_FAILURE = 1;

export const validateCommand = new Command("validate")
    .description("Validate DTCG JSON or HRDT YAML token files.")
    .argument("[files...]", "Paths to DTCG JSON or HRDT YAML token files (reads from stdin when omitted)")
    .addHelpText("after", "\nExit status:\n  0  success\n  1  unexpected error\n  2  validation errors found")
    .action(async (sources: string[]) => {
        try {
            const validator = new DtcgTokenValidator()
            const issues = await validator.validate(sources.length > 0 ? sources : ["-"]);
            printIssues(issues);
            if (hasErrors(issues)) {
                process.exit(EXIT_VALIDATION_ERROR);
            }
            console.log("Validation passed.");
        }
        catch (error) {
            console.error("Validation error:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

function formatIssue(issue: ValidationIssue): string {
    const source = issue.sourcePath === "-" ? "stdin" : issue.sourcePath;
    const location = issue.line === undefined ? ""
        : issue.column === undefined ? `:${issue.line}`
        : `:${issue.line}:${issue.column}`;
    return `[${issue.name}] ${issue.severity}: ${source}${location} - ${issue.message}`;
}

function printIssues(issues: ValidationIssue[]): void {
    for (const issue of issues) {
        const stream = issue.severity === "error" ? console.error : console.warn;
        stream(formatIssue(issue));
    }
}

function hasErrors(issues: ValidationIssue[]): boolean {
    return issues.some((i) => i.severity === "error");
}
