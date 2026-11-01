import type { AuditFinding, UncheckedSubject } from "#/core/audit/AuditFinding";
import type { AuditGrade } from "#/core/audit/AuditScore";
import { auditGrade } from "#/core/audit/AuditScore";
import { toAccessibilitySettings, type AccessibilityOptions } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import { TextContrastRule } from "#/core/audit/accessibility/rules/TextContrastRule";

/**
 * Counts the outcomes of automated text contrast checks.
 */
export interface ContrastScore {
    /** Percentage of passed evaluated checks, undefined when none were evaluated. */
    readonly score?: number;

    /** Design Token Kit grade, undefined when no check was evaluated. */
    readonly grade?: AuditGrade;

    /** Number of checks that were evaluated. */
    readonly evaluated: number;

    /** Number of evaluated checks that passed. */
    readonly passed: number;

    /** Number of evaluated checks that failed. */
    readonly failed: number;

    /** Number of checks requiring manual review. */
    readonly manualReview: number;

    /** Number of samples skipped because contrast inputs were unavailable. */
    readonly skipped: number;
}

/**
 * Result of the automated text contrast audit.
 */
export interface ContrastAuditResult {
    readonly findings: AuditFinding[];
    readonly unchecked: UncheckedSubject[];
    readonly score: ContrastScore;
}

/**
 * Audits text samples only against the selected WCAG contrast level.
 *
 * Readability rules remain available through {@link auditTextSamples}; this
 * function is the focused contract used by automated accessibility scoring.
 */
export function auditTextContrastSamples(
    samples: readonly TextSample[],
    options: AccessibilityOptions = {},
): ContrastAuditResult {
    const settings = toAccessibilitySettings(options);
    const rule = new TextContrastRule();
    const findings: AuditFinding[] = [];
    const unchecked: UncheckedSubject[] = [];
    let passed = 0;
    let skipped = 0;

    for (const sample of samples) {
        const outcome = rule.audit(sample, settings);
        findings.push(...outcome.findings);
        unchecked.push(...outcome.unchecked);
        if (outcome.findings.length > 0 || outcome.unchecked.length > 0) continue;
        if (hasContrastInputs(sample)) {
            passed++;
        } else {
            skipped++;
        }
    }

    return {
        findings,
        unchecked,
        score: computeContrastScore(passed, findings.length, unchecked.length, skipped),
    };
}

/**
 * Computes a percentage score from passed and failed automated checks.
 */
export function computeContrastScore(
    passed: number,
    failed: number,
    manualReview: number,
    skipped: number,
): ContrastScore {
    const evaluated = passed + failed;
    if (evaluated === 0) {
        return { evaluated, passed, failed, manualReview, skipped };
    }

    const score = Math.round((passed / evaluated) * 100);
    return { score, grade: auditGrade(score), evaluated, passed, failed, manualReview, skipped };
}

function hasContrastInputs(sample: TextSample): boolean {
    return sample.colorProblem === undefined
        && sample.foreground !== undefined
        && sample.background !== undefined
        && sample.background.alpha >= 1;
}
