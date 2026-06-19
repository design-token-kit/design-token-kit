import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { GradientStopCheck } from "#/core/check/checks/GradientStopCheck";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ColorValue } from "#/core/model/values/ColorValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }

function run(children: Record<string, TokenGroup | TokenNode<unknown>>) {
    const doc = new Dtcg(new TokenGroup({ children: new Map(Object.entries(children)) }));
    return new CheckRunner([new GradientStopCheck()]).runList(new DtcgList(doc));
}

describe("GradientStopCheck", () => {
    it("flags a duplicate numeric stop position", () => {
        const gradient = new GradientToken([
            new GradientStop(color(), 0),
            new GradientStop(color(), 0),
        ]);
        const issues = run({ g: gradient });
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("gradient-duplicate-stop");
        expect(issues[0].message).toContain("duplicate stop position 0");
    });

    it("accepts distinct stop positions", () => {
        const gradient = new GradientToken([
            new GradientStop(color(), 0),
            new GradientStop(color(), 1),
        ]);
        expect(run({ g: gradient })).toEqual([]);
    });

    it("ignores non-gradient tokens", () => {
        expect(run({ g: new GradientToken([new GradientStop(color(), 0)]) })).toEqual([]);
    });
});
