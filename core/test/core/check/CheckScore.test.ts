import { describe, expect, it } from "vitest";
import { computeCheckScore } from "#/core/check/CheckScore";

describe("computeCheckScore", () => {
    it("scores passed checks as a percentage and assigns a grade", () => {
        const result = computeCheckScore([
            { passed: true },
            { passed: true },
            { passed: true },
            { passed: true },
            { passed: false, severity: "warning" },
        ]);

        expect(result).toEqual({
            score: 80,
            grade: "B",
            passed: 4,
            total: 5,
            warnings: 1,
            errors: 0,
        });
    });

    it("counts warnings and errors as failed checks", () => {
        const result = computeCheckScore([
            { passed: true },
            { passed: false, severity: "warning" },
            { passed: false, severity: "error" },
        ]);

        expect(result).toMatchObject({ score: 33, passed: 1, total: 3, warnings: 1, errors: 1 });
    });

    it("does not assign a score to an empty check set", () => {
        expect(computeCheckScore([])).toBeUndefined();
    });
});
