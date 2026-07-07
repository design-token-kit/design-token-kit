import { describe, expect, it } from "vitest";
import { DtcgChecker } from "#/core/validation/DtcgChecker";
import { CheckScope } from "#/core/check/CheckScope";

function source(doc: object): string {
    return "content:" + JSON.stringify({ "$schema": "", ...doc });
}

describe("TailwindNamespaceCheck", () => {
    it("reports unsupported design-token-kit.tailwindNamespace values", async () => {
        const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([source({
            layout: {
                desktop: {
                    "$type": "dimension",
                    "$value": { "value": 1920, "unit": "px" },
                    "$extensions": {
                        "design-token-kit": {
                            "tailwindNamespace": "spacing",
                        },
                    },
                },
            },
        })]);

        expect(issues).toHaveLength(1);
        expect(issues[0]?.id).toBe("bad-tailwind-namespace");
        expect(issues[0]?.severity).toBe("warning");
        expect(issues[0]?.message).toContain('currently only "breakpoint" is supported');
    });

    it("allows the supported breakpoint namespace", async () => {
        const issues = await new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([source({
            layout: {
                desktop: {
                    "$type": "dimension",
                    "$value": { "value": 1920, "unit": "px" },
                    "$extensions": {
                        "design-token-kit": {
                            "tailwindNamespace": "breakpoint",
                        },
                    },
                },
            },
        })]);

        expect(issues).toEqual([]);
    });
});
