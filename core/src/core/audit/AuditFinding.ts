import type { CheckIssue, IssueSeverity } from "#/core/check/CheckIssue";
import type { TokenPath } from "#/core/model/TokenPath";

/**
 * Area of design quality an audit rule belongs to: accessibility and
 * readability, or whether a design is built from tokens.
 */
export type AuditCategory = "accessibility" | "token-usage";

/**
 * A design quality problem found by an audit rule.
 *
 * Shaped like a {@link CheckIssue}, so tools that print check diagnostics can
 * print audit findings too.
 */
export interface AuditFinding extends CheckIssue {
    /** Area of design quality the rule belongs to. */
    readonly category: AuditCategory;

    /** Identifier of the audited subject: a pair of token paths or a Figma node id. */
    readonly subjectId: string;

    /** The measured value the finding is about, e.g. `2.39:1`, `11px` or `1.2`. */
    readonly measurement?: string;

    /** Theme the finding applies to; `undefined` for the base token set. */
    readonly theme?: string;

    /** Token to use instead, when the rule found one. */
    readonly suggestion?: TokenSuggestion;
}

/**
 * A token an audit finding suggests using.
 */
export interface TokenSuggestion {
    /** Name of the variable or style. */
    readonly name: string;

    /** Whether its value equals the audited one, rather than only being close. */
    readonly exact: boolean;
}

/**
 * Something a rule was asked to audit but could not evaluate, such as text on
 * a translucent background whose contrast depends on what lies behind it.
 *
 * Unchecked subjects are reported separately and never affect the score.
 */
export interface UncheckedSubject {
    /** Identifier of the rule that skipped the subject. */
    readonly id: string;

    /** Area of design quality the rule belongs to. */
    readonly category: AuditCategory;

    /** Identifier of the audited subject. */
    readonly subjectId: string;

    /** Path to the source file. */
    readonly sourcePath?: string;

    /** Path to the token the subject was built from. */
    readonly tokenPath?: TokenPath;

    /** Theme the subject belongs to; `undefined` for the base token set. */
    readonly theme?: string;

    /** Why the subject could not be evaluated. */
    readonly message: string;
}

/**
 * Describes one audit rule for discovery and documentation purposes.
 */
export interface AuditRuleInfo {
    /** Rule identifier, usable in the rule allow-list. */
    readonly id: string;

    /** Area of design quality the rule belongs to. */
    readonly category: AuditCategory;

    /** Highest severity of the findings the rule emits. */
    readonly severity: IssueSeverity;

    /** One-line, human-readable summary of what the rule looks for. */
    readonly description: string;
}
