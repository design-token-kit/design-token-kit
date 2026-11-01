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
 * Finds text smaller than the smallest readable font size.
 *
 * WCAG sets no minimum font size, so this is a readability heuristic and its
 * findings are warnings.
 */
export class TextSizeRule implements TextAuditRule {
    readonly id = "text-size";
    readonly category: AuditCategory = "accessibility";
    readonly description = "Text smaller than the smallest readable font size (12px by default).";
    readonly defaultSeverity: IssueSeverity = "warning";

    audit(sample: TextSample, settings: AccessibilitySettings): TextAuditResult {
        const size = sample.fontSizePx;
        if (size === undefined || size >= settings.minFontSizePx) {
            return { findings: [], unchecked: [] };
        }
        return {
            findings: [sampleFinding(this, sample, "warning",
                `font size ${formatNumber(size)}px is below the ${formatNumber(settings.minFontSizePx)}px minimum for readable text.`,
                `${formatNumber(size)}px`)],
            unchecked: [],
        };
    }
}
