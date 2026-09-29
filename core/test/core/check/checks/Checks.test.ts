import { describe, it, expect } from "vitest";
import { listChecks, validationChecks, lintingChecks } from "#/core/check/checks/Checks";
import { CheckScope } from "#/core/check/CheckScope";

describe("listChecks", () => {
    it("lists one entry per selectable check, in pipeline order", () => {
        const expectedIds = [
            ...validationChecks().map((check) => check.id),
            ...lintingChecks().map((check) => check.id),
        ];
        expect(listChecks().map((info) => info.id)).toEqual(expectedIds);
    });

    it("groups validation checks under the validate scope", () => {
        const validationIds = new Set(validationChecks().map((check) => check.id));
        const validateScoped = listChecks().filter((info) => info.scope === CheckScope.VALIDATE);
        expect(new Set(validateScoped.map((info) => info.id))).toEqual(validationIds);
    });

    it("groups linting checks under the lint scope", () => {
        const lintingIds = new Set(lintingChecks().map((check) => check.id));
        const lintScoped = listChecks().filter((info) => info.scope === CheckScope.LINT);
        expect(new Set(lintScoped.map((info) => info.id))).toEqual(lintingIds);
    });

    it("gives every check a non-empty description", () => {
        for (const info of listChecks()) {
            expect(info.description.length).toBeGreaterThan(0);
        }
    });

    it("marks missing-description as opt-in", () => {
        expect(listChecks().find((info) => info.id === "missing-description"))
            .toMatchObject({ enabledByDefault: false });
        expect(listChecks()
            .filter((info) => info.id !== "missing-description")
            .every((info) => info.enabledByDefault)).toBe(true);
    });
});
