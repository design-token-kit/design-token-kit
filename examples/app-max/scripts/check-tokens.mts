/**
 * Validates the example DTCG token files and prints every reported issue.
 * Exits with code 2 when at least one validation error is found.
 */
import { DtcgChecker, type CheckIssue } from "@design-token-kit/core";

const issues = await new DtcgChecker().validate([
    "./src/styles/tokens/tokens.json",
    "./src/styles/tokens/tokens.dark.json",
]);

for (const issue of issues) {
    printIssue(issue);
}

if (issues.some((issue) => issue.severity === "error")) {
    process.exit(2);
}

console.log("Token validation passed.");

/**
 * Prints one validation issue in a compact, readable format.
 */
function printIssue(issue: CheckIssue): void {
    console.log(
        issue.severity,
        issue.sourcePath,
        issue.tokenPath?.toString(),
        issue.message,
    );
}
