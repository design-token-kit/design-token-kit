import type { AuditCategory } from "#/core/audit/AuditFinding";
import type { AccessibilitySettings } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import {
    sampleFinding,
    uncheckedSample,
    formatNumber,
    type TextAuditResult,
    type TextAuditRule,
} from "#/core/audit/accessibility/TextAuditRule";
import { formatSrgbColor } from "#/core/audit/color/SrgbColor";
import {
    compositeOver,
    contrastRatio,
    formatContrastRatio,
    isLargeText,
    minimumContrast,
} from "#/core/audit/color/Wcag";
import type { IssueSeverity } from "#/core/check/CheckIssue";

/**
 * Finds text whose contrast with its background is below the WCAG minimum.
 *
 * Text below the AA minimum is an error. When the audit targets AAA, text that
 * meets AA but not AAA is a warning. Large text needs less contrast; text of
 * unknown size, such as a pair of color tokens, is held to the normal text
 * minimum. A translucent text color is composited over its background first;
 * a translucent background cannot be evaluated, because the contrast then
 * depends on whatever lies behind it.
 *
 * @see https://www.w3.org/TR/WCAG22/#contrast-minimum
 */
export class TextContrastRule implements TextAuditRule {
    readonly id = "text-contrast";
    readonly category: AuditCategory = "accessibility";
    readonly description = "Text whose contrast with its background is below the WCAG minimum (AA, or AAA when targeted).";
    readonly defaultSeverity: IssueSeverity = "error";

    audit(sample: TextSample, settings: AccessibilitySettings): TextAuditResult {
        if (sample.colorProblem !== undefined) {
            return { findings: [], unchecked: [uncheckedSample(this, sample, sample.colorProblem)] };
        }
        const { foreground, background } = sample;
        if (foreground === undefined || background === undefined) {
            return { findings: [], unchecked: [] };
        }
        if (background.alpha < 1) {
            return {
                findings: [],
                unchecked: [uncheckedSample(
                    this,
                    sample,
                    `the background is translucent (alpha ${formatNumber(background.alpha)}), so the contrast depends on what lies behind it.`,
                )],
            };
        }

        const text = compositeOver(foreground, background);
        const ratio = contrastRatio(text, background);
        const largeText = isLargeText(sample.fontSizePx, sample.fontWeight);
        const textKind = largeText ? "large text" : "normal text";
        const colors = `${formatSrgbColor(foreground)} on ${formatSrgbColor(background)}`;
        const formattedRatio = formatContrastRatio(ratio);
        const measured = `contrast ${formattedRatio} (${colors})`;

        const minimumAa = minimumContrast("AA", largeText);
        if (ratio < minimumAa) {
            return {
                findings: [sampleFinding(this, sample, "error",
                    `${measured} is below ${minimumAa}:1, the WCAG AA minimum for ${textKind}.`, formattedRatio)],
                unchecked: [],
            };
        }

        const minimumAaa = minimumContrast("AAA", largeText);
        if (settings.level === "AAA" && ratio < minimumAaa) {
            return {
                findings: [sampleFinding(this, sample, "warning",
                    `${measured} meets WCAG AA but is below ${minimumAaa}:1, the WCAG AAA minimum for ${textKind}.`, formattedRatio)],
                unchecked: [],
            };
        }
        return { findings: [], unchecked: [] };
    }
}
