import { Command } from "commander";
import {
    DtcgTokenValidator,
    type ValidationIssue,
} from "@design-token-kit/core";

function formatIssue(issue: ValidationIssue): string {
    const location = issue.line === undefined ? ""
        : issue.column === undefined ? `:${issue.line}`
        : `:${issue.line}:${issue.column}`;
    return `[${issue.name}] ${issue.severity}: ${issue.sourcePath}${location} - ${issue.message}`;
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

export const validateCommand = new Command("validate")
    .description("Validate DTCG JSON or HRDT YAML token files.")
    .argument("<sources...>", "Paths to token JSON or HRDT files")
    .action(async (sources: string[]) => {
        try {
            const validator = new DtcgTokenValidator()
            const issues = await validator.validate(sources);
            printIssues(issues);
            if (hasErrors(issues)) {
                process.exit(2);
            }
            console.log("Validation passed.");
        }
        catch (error) {
            console.error("Validation error:", (error as Error).message);
            process.exit(1);
        }
    });
