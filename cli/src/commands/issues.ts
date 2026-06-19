import type { CheckIssue } from "@design-token-kit/core";

/**
 * Formats a single issue for terminal output.
 */
export function formatIssue(issue: CheckIssue): string {
    const source = issue.sourcePath === "-" ? "stdin" : issue.sourcePath;
    const location = issue.line === undefined ? ""
        : issue.column === undefined ? `:${issue.line}`
        : `:${issue.line}:${issue.column}`;
    return `[${issue.id}] ${issue.severity}: ${source}${location} - ${issue.message}`;
}

/**
 * Prints issues, routing errors to stderr and warnings to stdout.
 */
export function printIssues(issues: CheckIssue[]): void {
    for (const issue of issues) {
        const stream = issue.severity === "error" ? console.error : console.warn;
        stream(formatIssue(issue));
    }
}

/**
 * Returns true when at least one issue has error severity.
 */
export function hasErrors(issues: CheckIssue[]): boolean {
    return issues.some((i) => i.severity === "error");
}
