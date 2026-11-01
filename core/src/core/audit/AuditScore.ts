/**
 * Letter grade of an audit score.
 */
export type AuditGrade = "A" | "B" | "C" | "D" | "F";

/**
 * A design quality score from 0 to 100 and its letter grade.
 */
export interface AuditScore {
    readonly score: number;
    readonly grade: AuditGrade;
}

/**
 * Weights of the audit score formula.
 */
export interface AuditScoreWeights {
    /** Points one error takes off the score. Defaults to 2. */
    readonly error?: number;

    /** Points one warning takes off the score. Defaults to 0.1. */
    readonly warning?: number;
}

const DEFAULT_ERROR_WEIGHT = 2;
const DEFAULT_WARNING_WEIGHT = 0.1;

const GRADES: ReadonlyArray<{ min: number; grade: AuditGrade }> = [
    { min: 90, grade: "A" },
    { min: 80, grade: "B" },
    { min: 70, grade: "C" },
    { min: 60, grade: "D" },
];

/**
 * Computes the audit score: `100 - 2 * errors - 0.1 * warnings`, rounded and
 * never below 0.
 *
 * Grades: A for 90 and above, B for 80 to 89, C for 70 to 79, D for 60 to 69,
 * F below 60. Unchecked subjects do not count.
 *
 * @param errors - Number of error findings.
 * @param warnings - Number of warning findings.
 * @param weights - Points each error and warning take off the score.
 */
export function computeAuditScore(errors: number, warnings: number, weights: AuditScoreWeights = {}): AuditScore {
    const errorWeight = weights.error ?? DEFAULT_ERROR_WEIGHT;
    const warningWeight = weights.warning ?? DEFAULT_WARNING_WEIGHT;
    const score = Math.max(0, Math.round(100 - errorWeight * errors - warningWeight * warnings));
    return { score, grade: auditGrade(score) };
}

/**
 * Returns the letter grade of a score from 0 to 100: A for 90 and above, B for
 * 80 to 89, C for 70 to 79, D for 60 to 69, F below 60.
 */
export function auditGrade(score: number): AuditGrade {
    return GRADES.find((entry) => score >= entry.min)?.grade ?? "F";
}
