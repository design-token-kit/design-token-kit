import { describe, expect, it } from "vitest";
import { DtcgChecker } from "#/core/validation/DtcgChecker";
import { CheckScope } from "#/core/check/CheckScope";

const SPACE = {
    space: {
        "$type": "dimension",
        "md": { "$value": { "value": 1.5, "unit": "rem" } },
    },
};

function source(doc: object): string {
    return "content:" + JSON.stringify({ "$schema": "", ...doc });
}

function validate(doc: object) {
    return new DtcgChecker({ scope: CheckScope.VALIDATE }).validate([source(doc)]);
}

describe("RemBaseCheck", () => {
    it("reports a non-numeric remBase", async () => {
        const issues = await validate({
            ...SPACE,
            "$extensions": { "design-token-kit": { "remBase": "sixteen" } },
        });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.id).toBe("bad-rem-base");
        expect(issues[0]?.severity).toBe("warning");
        expect(issues[0]?.message).toContain("use a positive number");
    });

    it.each([0, -16])("reports a non-positive remBase %s", async (remBase) => {
        const issues = await validate({
            ...SPACE,
            "$extensions": { "design-token-kit": { "remBase": remBase } },
        });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.id).toBe("bad-rem-base");
    });

    it("allows a positive remBase", async () => {
        const issues = await validate({
            ...SPACE,
            "$extensions": { "design-token-kit": { "remBase": 10 } },
        });

        expect(issues).toEqual([]);
    });

    it("ignores documents without the extension", async () => {
        expect(await validate(SPACE)).toEqual([]);
    });

    it("ignores a remBase declared on a non-root group", async () => {
        const issues = await validate({
            space: {
                "$type": "dimension",
                "$extensions": { "design-token-kit": { "remBase": "sixteen" } },
                "md": { "$value": { "value": 1.5, "unit": "rem" } },
            },
        });

        expect(issues).toEqual([]);
    });
});
