import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { RootLayerCheck } from "#/core/check/checks/RootLayerCheck";
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
    return new CheckRunner([new RootLayerCheck()]).runList(new DtcgList(new Dtcg(root)));
}

describe("RootLayerCheck", () => {
    it("accepts default root layers", () => {
        const issues = run(group({
            primitive: group({ brand: new ColorToken(color()) }),
            semantic: group({ color: group() }),
            component: group({ button: group() }),
        }));

        expect(issues).toEqual([]);
    });

    it("rejects a token path outside configured root layers", () => {
        const issues = run(group({
            color: group({ brand: new ColorToken(color()) }),
        }));

        expect(issues).toHaveLength(2);
        expect(issues[0].id).toBe("root-layer");
        expect(issues[0].tokenPath?.toString()).toBe("color");
        expect(issues[0].message).toBe("color: path must start with one of: primitive, semantic, component");
        expect(issues[1].tokenPath?.toString()).toBe("color.brand");
    });

    it("skips the synthetic root path", () => {
        expect(run(group())).toEqual([]);
    });
});
