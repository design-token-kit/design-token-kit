import type { AuditRuleInfo } from "#/core/audit/AuditFinding";
import { toAccessibilitySettings, type AccessibilityOptions } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import type { TextAuditResult, TextAuditRule } from "#/core/audit/accessibility/TextAuditRule";
import { LineHeightRule } from "#/core/audit/accessibility/rules/LineHeightRule";
import { TextContrastRule } from "#/core/audit/accessibility/rules/TextContrastRule";
import { TextSizeRule } from "#/core/audit/accessibility/rules/TextSizeRule";

/**
 * Returns the accessibility and readability rules, in reporting order.
 */
export function accessibilityRules(): TextAuditRule[] {
    return [new TextContrastRule(), new TextSizeRule(), new LineHeightRule()];
}

/**
 * Returns metadata for every audit rule.
 */
export function listAuditRules(): AuditRuleInfo[] {
    return accessibilityRules().map((rule) => ({
        id: rule.id,
        category: rule.category,
        severity: rule.defaultSeverity,
        description: rule.description,
    }));
}

/**
 * Options of {@link auditTextSamples}.
 */
export interface TextAuditOptions extends AccessibilityOptions {
    /**
     * Allow-list of rule ids to run. When omitted or empty, every rule runs.
     */
    readonly rules?: readonly string[];
}

/**
 * Applies the accessibility and readability rules to text samples.
 *
 * The samples may come from token files or from a Figma document; the rules do
 * not depend on the source.
 */
export function auditTextSamples(samples: readonly TextSample[], options: TextAuditOptions = {}): TextAuditResult {
    const settings = toAccessibilitySettings(options);
    const rules = selectRules(accessibilityRules(), options.rules);
    const result: TextAuditResult = { findings: [], unchecked: [] };

    for (const rule of rules) {
        for (const sample of samples) {
            const outcome = rule.audit(sample, settings);
            result.findings.push(...outcome.findings);
            result.unchecked.push(...outcome.unchecked);
        }
    }
    return result;
}

function selectRules(rules: TextAuditRule[], allowList: readonly string[] | undefined): TextAuditRule[] {
    if (allowList === undefined || allowList.length === 0) {
        return rules;
    }
    const enabled = new Set(allowList);
    return rules.filter((rule) => enabled.has(rule.id));
}
