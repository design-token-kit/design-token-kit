import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { TypeMismatchCheck } from "#/core/check/checks/TypeMismatchCheck";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }
function dim(): DimensionValue { return new DimensionValue(4, "px"); }

function run(children: Record<string, TokenGroup | TokenNode<unknown>>) {
    const doc = new Dtcg(new TokenGroup({ children: new Map(Object.entries(children)) }));
    return new CheckRunner([new TypeMismatchCheck()]).runList(new DtcgList(doc));
}

describe("TypeMismatchCheck", () => {
    it("flags a typed alias resolving to a different type", () => {
        const issues = run({
            size: new DimensionToken(dim()),
            brand: new ColorToken(new TokenReference("size")),
        });
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("type-mismatch");
        expect(issues[0].message).toContain('token is "color" but references "dimension"');
    });

    it("accepts an alias resolving to the same type", () => {
        const issues = run({
            red: new ColorToken(color()),
            brand: new ColorToken(new TokenReference("red")),
        });
        expect(issues).toEqual([]);
    });

    it("ignores non-alias tokens", () => {
        expect(run({ red: new ColorToken(color()) })).toEqual([]);
    });
});
