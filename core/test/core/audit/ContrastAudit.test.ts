import { describe, expect, it } from "vitest";
import { auditTextContrastSamples, computeContrastScore } from "#/core/audit/accessibility/ContrastAudit";
import type { TextSample } from "#/core/audit/accessibility/TextSample";
import type { SrgbColor } from "#/core/audit/color/SrgbColor";

const WHITE: SrgbColor = { red: 1, green: 1, blue: 1, alpha: 1 };

function gray(byte: number): SrgbColor {
    const channel = byte / 255;
    return { red: channel, green: channel, blue: channel, alpha: 1 };
}

function pair(byte: number, extra: Partial<TextSample> = {}): TextSample {
    return {
        id: `gray-${byte}`,
        label: "text on white",
        foreground: gray(byte),
        background: WHITE,
        ...extra,
    };
}

describe("auditTextContrastSamples", () => {
    it("scores measured AA passes and failures without rounding the threshold", () => {
        const result = auditTextContrastSamples([pair(0x76), pair(0x77)]);

        expect(result.findings).toHaveLength(1);
        expect(result.score).toEqual({
            score: 50,
            grade: "F",
            evaluated: 2,
            passed: 1,
            failed: 1,
            manualReview: 0,
            skipped: 0,
        });
    });

    it("uses the large-text AA threshold and preserves font weight classification", () => {
        const result = auditTextContrastSamples([
            pair(0x94, { fontSizePx: 24 }),
            pair(0x94, { fontSizePx: 18.66, fontWeight: 700 }),
            pair(0x94, { fontSizePx: 18.66, fontWeight: 600 }),
        ]);

        expect(result.score).toMatchObject({ evaluated: 3, passed: 2, failed: 1 });
    });

    it("uses AAA thresholds when requested and treats AA failures as failures", () => {
        const result = auditTextContrastSamples([pair(0x76), pair(0x77), pair(0x40)], { level: "AAA" });

        expect(result.findings).toHaveLength(2);
        expect(result.findings.map((finding) => finding.severity)).toEqual(["warning", "error"]);
        expect(result.score).toMatchObject({ evaluated: 3, passed: 1, failed: 2 });
    });

    it("excludes manual review from the percentage denominator", () => {
        const result = auditTextContrastSamples([
            pair(0),
            { id: "gradient", label: "text on gradient", colorProblem: "gradient" },
        ]);

        expect(result.score).toEqual({
            score: 100,
            grade: "A",
            evaluated: 1,
            passed: 1,
            failed: 0,
            manualReview: 1,
            skipped: 0,
        });
    });

    it("excludes samples without contrast inputs as skipped", () => {
        const result = auditTextContrastSamples([{ id: "missing", label: "missing colors" }]);

        expect(result.score).toEqual({ evaluated: 0, passed: 0, failed: 0, manualReview: 0, skipped: 1 });
    });

    it("excludes samples whose text role needs manual review from scoring", () => {
        const result = auditTextContrastSamples([pair(0), {
            ...pair(0x77),
            id: "symbol",
            label: "symbol",
            manualReviewReason: "the symbol role is ambiguous",
        }]);

        expect(result.findings).toEqual([]);
        expect(result.unchecked).toEqual([expect.objectContaining({
            subjectId: "symbol",
            message: "symbol: the symbol role is ambiguous",
        })]);
        expect(result.score).toMatchObject({ evaluated: 1, passed: 1, failed: 0, manualReview: 1 });
    });
});

describe("computeContrastScore", () => {
    it("returns N/A data when no check was evaluated", () => {
        expect(computeContrastScore(0, 0, 5, 2)).toEqual({
            evaluated: 0,
            passed: 0,
            failed: 0,
            manualReview: 5,
            skipped: 2,
        });
    });

    it("calculates the percentage and preserves the existing grade bands", () => {
        expect(computeContrastScore(47, 3, 5, 0)).toEqual({
            score: 94,
            grade: "A",
            evaluated: 50,
            passed: 47,
            failed: 3,
            manualReview: 5,
            skipped: 0,
        });
    });
});
