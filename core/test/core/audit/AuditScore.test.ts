import { describe, expect, it } from "vitest";
import { computeAuditScore } from "#/core/audit/AuditScore";

describe("computeAuditScore", () => {
    it("takes 2 points per error and 0.1 per warning, rounded", () => {
        expect(computeAuditScore(0, 0)).toEqual({ score: 100, grade: "A" });
        expect(computeAuditScore(8, 84)).toEqual({ score: 76, grade: "C" });
        expect(computeAuditScore(0, 5)).toEqual({ score: 100, grade: "A" });
        expect(computeAuditScore(0, 6)).toEqual({ score: 99, grade: "A" });
    });

    it.each([
        [5, "A", 90],
        [6, "B", 88],
        [10, "B", 80],
        [11, "C", 78],
        [15, "C", 70],
        [16, "D", 68],
        [20, "D", 60],
        [21, "F", 58],
    ])("grades %i errors as %s", (errors, grade, score) => {
        expect(computeAuditScore(errors, 0)).toEqual({ score, grade });
    });

    it("never goes below 0", () => {
        expect(computeAuditScore(80, 1000)).toEqual({ score: 0, grade: "F" });
    });

    it("uses the given weights", () => {
        expect(computeAuditScore(2, 10, { error: 5, warning: 1 })).toEqual({ score: 80, grade: "B" });
        expect(computeAuditScore(2, 10, { warning: 0 })).toEqual({ score: 96, grade: "A" });
    });
});
