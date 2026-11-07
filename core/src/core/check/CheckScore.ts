import type { IssueSeverity } from "#/core/check/CheckIssue";

/**
 * A check outcome used to calculate a token architecture score.
 */
export interface CheckScoreInput {
    /** Whether the check found no issues. */
    readonly passed: boolean;

    /** Severity of a failed check. */
    readonly severity?: IssueSeverity;
}

/**
 * A token architecture score and its check counts.
 */
export interface CheckScore {
    readonly score: number;
    readonly grade: CheckGrade;
    readonly passed: number;
    readonly total: number;
    readonly warnings: number;
    readonly errors: number;
}

/**
 * Letter grade assigned to a token architecture score.
 */
export type CheckGrade = "A" | "B" | "C" | "D" | "F";

/**
 * Computes the percentage of checks that passed.
 *
 * A check passes when it found no issues. Warnings and errors count equally as
 * failed checks. An empty set has no score.
 */
export function computeCheckScore(checks: readonly CheckScoreInput[]): CheckScore | undefined {
    if (checks.length === 0) {
        return undefined;
    }

    const passed = checks.filter((check) => check.passed).length;
    const failed = checks.length - passed;
    const errors = checks.filter((check) => !check.passed && check.severity === "error").length;
    const warnings = failed - errors;
    const score = Math.floor((passed / checks.length) * 100);

    return {
        score,
        grade: checkGrade(score),
        passed,
        total: checks.length,
        warnings,
        errors,
    };
}

function checkGrade(score: number): CheckGrade {
    return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}
