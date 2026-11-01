import type { AuditCategory } from "#/core/audit/AuditFinding";
import type { AccessibilitySettings } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import {
    sampleFinding,
    formatNumber,
    type TextAuditResult,
    type TextAuditRule,
} from "#/core/audit/accessibility/TextAuditRule";
import type { IssueSeverity } from "#/core/check/CheckIssue";

/**
 * Finds body text whose lines are set too tightly to read comfortably.
 *
 * Headings are commonly set tighter, so text at or above the heading size is
 * not audited. This is a readability heuristic and its findings are warnings.
 *
 * @see https://www.w3.org/TR/WCAG22/#text-spacing
 */
export class LineHeightRule implements TextAuditRule {
    readonly id = "line-height";
    readonly category: AuditCategory = "accessibility";
    readonly description = "Body text whose line height is below the readable minimum (1.3 by default).";
    readonly defaultSeverity: IssueSeverity = "warning";

    audit(sample: TextSample, settings: AccessibilitySettings): TextAuditResult {
        const { fontSizePx, lineHeight } = sample;
        if (fontSizePx === undefined || lineHeight === undefined
            || fontSizePx >= settings.headingSizePx || lineHeight >= settings.minBodyLineHeight) {
            return { findings: [], unchecked: [] };
        }
        return {
            findings: [sampleFinding(this, sample, "warning",
                `line height ${formatNumber(lineHeight)} is below ${formatNumber(settings.minBodyLineHeight)}, `
                + `the readable minimum for body text (${formatNumber(fontSizePx)}px).`, formatNumber(lineHeight))],
            unchecked: [],
        };
    }
}
