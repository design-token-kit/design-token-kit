import type { AuditCategory, AuditFinding, UncheckedSubject } from "#/core/audit/AuditFinding";
import type { AccessibilitySettings } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import type { IssueSeverity } from "#/core/check/CheckIssue";

/**
 * An accessibility or readability rule applied to every {@link TextSample}.
 */
export interface TextAuditRule {
    /** Rule identifier, e.g. {@code "text-contrast"}. */
    readonly id: string;

    /** Area of design quality the rule belongs to. */
    readonly category: AuditCategory;

    /** One-line, human-readable summary of what the rule looks for. */
    readonly description: string;

    /** Highest severity of the findings the rule emits. */
    readonly defaultSeverity: IssueSeverity;

    /**
     * Audits a single sample.
     *
     * @returns The findings and the subjects the rule could not evaluate;
     *   both empty when the sample lacks the fields the rule reads.
     */
    audit(sample: TextSample, settings: AccessibilitySettings): TextAuditResult;
}

/**
 * Outcome of auditing text samples.
 */
export interface TextAuditResult {
    readonly findings: AuditFinding[];
    readonly unchecked: UncheckedSubject[];
}

/**
 * Builds a finding of a rule for a sample.
 */
export function sampleFinding(
    rule: TextAuditRule,
    sample: TextSample,
    severity: IssueSeverity,
    message: string,
    measurement?: string,
): AuditFinding {
    return {
        id: rule.id,
        category: rule.category,
        severity,
        message: `${sample.label}: ${message}`,
        subjectId: sample.id,
        measurement,
        sourcePath: sample.sourcePath,
        tokenPath: sample.tokenPath,
        theme: sample.theme,
    };
}

/**
 * Records that a rule could not evaluate a sample.
 */
export function uncheckedSample(rule: TextAuditRule, sample: TextSample, message: string): UncheckedSubject {
    return {
        id: rule.id,
        category: rule.category,
        subjectId: sample.id,
        sourcePath: sample.sourcePath,
        tokenPath: sample.tokenPath,
        theme: sample.theme,
        message: `${sample.label}: ${message}`,
    };
}

/**
 * Formats a measurement without trailing zeros, at most two decimals.
 */
export function formatNumber(value: number): string {
    return String(Number(value.toFixed(2)));
}
