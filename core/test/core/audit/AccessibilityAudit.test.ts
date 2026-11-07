import { describe, expect, it } from "vitest";
import { auditTextSamples, listAuditRules } from "#/core/audit/accessibility/AccessibilityAudit";
import { toAccessibilitySettings } from "#/core/audit/accessibility/AccessibilitySettings";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import type { SrgbColor } from "#/core/audit/color/SrgbColor";

const WHITE: SrgbColor = { red: 1, green: 1, blue: 1, alpha: 1 };

function gray(byte: number, alpha = 1): SrgbColor {
    return { red: byte / 255, green: byte / 255, blue: byte / 255, alpha };
}

function pair(foreground: SrgbColor, background: SrgbColor, extra: Partial<TextSample> = {}): TextSample {
    return { id: "text|bg", label: "text on bg", foreground, background, ...extra };
}

function text(fontSizePx: number, lineHeight?: number): TextSample {
    return { id: "type", label: "type", fontSizePx, lineHeight };
}

describe("listAuditRules", () => {
    it("lists the accessibility rules", () => {
        expect(listAuditRules().map((rule) => [rule.id, rule.category, rule.severity])).toEqual([
            ["text-contrast", "accessibility", "error"],
            ["text-size", "accessibility", "warning"],
            ["line-height", "accessibility", "warning"],
        ]);
    });
});

describe("text-contrast", () => {
    it("reports normal text below the AA minimum as an error", () => {
        const { findings } = auditTextSamples([pair(gray(0x77), WHITE)]);
        expect(findings).toEqual([expect.objectContaining({
            id: "text-contrast",
            severity: "error",
            subjectId: "text|bg",
            measurement: "4.47:1",
            message: "text on bg: contrast 4.47:1 (#777777 on #ffffff) is below 4.5:1, the WCAG AA minimum for normal text.",
        })]);
    });

    it("accepts the same colors for large text", () => {
        expect(auditTextSamples([pair(gray(0x77), WHITE, { fontSizePx: 24 })]).findings).toEqual([]);
    });

    it("warns about text between the AA and AAA minimums when AAA is targeted", () => {
        const sample = pair(gray(0x70), WHITE);
        expect(auditTextSamples([sample]).findings).toEqual([]);
        expect(auditTextSamples([sample], { level: "AAA" }).findings).toEqual([expect.objectContaining({
            severity: "warning",
            message: expect.stringContaining("meets WCAG AA but is below 7:1, the WCAG AAA minimum for normal text"),
        })]);
    });

    it("composites translucent text over its background", () => {
        expect(auditTextSamples([pair(gray(0, 0.4), WHITE)]).findings).toHaveLength(1);
        expect(auditTextSamples([pair(gray(0, 0.9), WHITE)]).findings).toEqual([]);
    });

    it("cannot evaluate text on a translucent background", () => {
        const { findings, unchecked } = auditTextSamples([pair(gray(0), gray(255, 0.5))]);
        expect(findings).toEqual([]);
        expect(unchecked).toEqual([expect.objectContaining({
            id: "text-contrast",
            message: "text on bg: the background is translucent (alpha 0.5), so the contrast depends on what lies behind it.",
        })]);
    });

    it("reports unreadable colors as unchecked", () => {
        const sample: TextSample = { id: "x", label: "x", colorProblem: "cannot read text" };
        expect(auditTextSamples([sample]).unchecked).toEqual([expect.objectContaining({ message: "x: cannot read text" })]);
    });

    it("skips samples without colors", () => {
        expect(auditTextSamples([text(16, 1.5)], { rules: ["text-contrast"] })).toEqual({ findings: [], unchecked: [] });
    });
});

describe("text-size", () => {
    it("warns about text below the minimum size", () => {
        expect(auditTextSamples([text(11)]).findings).toEqual([expect.objectContaining({
            id: "text-size",
            severity: "warning",
            measurement: "11px",
            message: "type: font size 11px is below the 12px minimum for readable text.",
        })]);
        expect(auditTextSamples([text(12)]).findings).toEqual([]);
    });

    it("uses the configured minimum", () => {
        expect(auditTextSamples([text(13)], { minFontSizePx: 14 }).findings).toHaveLength(1);
    });
});

describe("line-height", () => {
    it("warns about tight body text", () => {
        expect(auditTextSamples([text(15, 1.2)]).findings).toEqual([expect.objectContaining({
            id: "line-height",
            severity: "warning",
            measurement: "1.2",
            message: "type: line height 1.2 is below 1.3, the readable minimum for body text (15px).",
        })]);
    });

    it("leaves headings and text without a line height alone", () => {
        expect(auditTextSamples([text(18, 1)]).findings).toEqual([]);
        expect(auditTextSamples([text(15)]).findings).toEqual([]);
        expect(auditTextSamples([text(18, 1)], { headingSizePx: 20 }).findings).toHaveLength(1);
    });
});

describe("toAccessibilitySettings", () => {
    it("applies the defaults", () => {
        expect(toAccessibilitySettings()).toEqual({ level: "AA", minFontSizePx: 12, minBodyLineHeight: 1.3, headingSizePx: 18 });
    });

    it("keeps the given options", () => {
        expect(toAccessibilitySettings({ level: "AAA", minFontSizePx: 14, minBodyLineHeight: 1.5, headingSizePx: 20 }))
            .toEqual({ level: "AAA", minFontSizePx: 14, minBodyLineHeight: 1.5, headingSizePx: 20 });
    });
});

describe("text-contrast at AAA", () => {
    it("still reports text below AA as an error", () => {
        expect(auditTextSamples([pair(gray(0x77), WHITE)], { level: "AAA" }).findings)
            .toEqual([expect.objectContaining({ severity: "error" })]);
    });

    it("holds large text to 4.5:1", () => {
        const large = { fontSizePx: 18.66, fontWeight: 700 };
        expect(auditTextSamples([pair(gray(0x77), WHITE, large)], { level: "AAA" }).findings).toEqual([expect.objectContaining({
            severity: "warning",
            measurement: "4.47:1",
            message: expect.stringContaining("below 4.5:1, the WCAG AAA minimum for large text"),
        })]);
        expect(auditTextSamples([pair(gray(0x76), WHITE, large)], { level: "AAA" }).findings).toEqual([]);
    });

    it("passes text that meets AAA", () => {
        expect(auditTextSamples([pair(gray(0x40), WHITE)], { level: "AAA" }).findings).toEqual([]);
    });
});

describe("auditTextSamples", () => {
    it("runs only the allowed rules", () => {
        const samples = [pair(gray(0x77), WHITE), text(10, 1)];
        expect(auditTextSamples(samples, { rules: ["text-size"] }).findings.map((finding) => finding.id)).toEqual(["text-size"]);
        expect(auditTextSamples(samples, { rules: [] }).findings.map((finding) => finding.id))
            .toEqual(["text-contrast", "text-size", "line-height"]);
    });
});
