import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { EmptyGroupCheck } from "#/core/check/checks/EmptyGroupCheck";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import type { TokenNode } from "#/core/model/TokenNode";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { ColorValue } from "#/core/model/values/ColorValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }

function group(children: Record<string, TokenGroup | TokenNode<unknown>> = {}): TokenGroup {
    return new TokenGroup({ children: new Map(Object.entries(children)) });
}

function run(root: TokenGroup) {
    return new CheckRunner([new EmptyGroupCheck()]).runList(new DtcgList(new Dtcg(root)));
}

describe("EmptyGroupCheck", () => {
    it("warns about an empty nested named group", () => {
        const issues = run(group({
            semantic: group({ color: group() }),
        }));

        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("empty-group");
        expect(issues[0].severity).toBe("warning");
        expect(issues[0].tokenPath?.toString()).toBe("semantic.color");
        expect(issues[0].message).toBe("semantic.color: group has no tokens or child groups");
    });

    it("accepts non-empty groups", () => {
        const issues = run(group({
            primitive: group({ brand: new ColorToken(color()) }),
        }));

        expect(issues).toEqual([]);
    });

    it("skips an empty root group", () => {
        const issues = run(group());

        expect(issues).toEqual([]);
    });

    it("accepts groups with a $root token", () => {
        const issues = run(group({
            primitive: new TokenGroup({ root: new ColorToken(color()) }),
        }));

        expect(issues).toEqual([]);
    });
});
