import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { MissingDescriptionCheck } from "#/core/check/checks/MissingDescriptionCheck";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import type { TokenNode } from "#/core/model/TokenNode";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { ColorValue } from "#/core/model/values/ColorValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }

function group(children: Record<string, TokenGroup | TokenNode<unknown>> = {}): TokenGroup {
    return new TokenGroup({ children: new Map(Object.entries(children)) });
}

function run(root: TokenGroup) {
    return new CheckRunner([new MissingDescriptionCheck()]).runList(new DtcgList(new Dtcg(root)));
}

describe("MissingDescriptionCheck", () => {
    it("warns about a token without $description", () => {
        const issues = run(group({
            primitive: group({ red: new ColorToken(color()) }),
        }));

        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("missing-description");
        expect(issues[0].severity).toBe("warning");
        expect(issues[0].tokenPath?.toString()).toBe("primitive.red");
        expect(issues[0].message).toBe("primitive.red: token has no $description");
    });

    it("warns about a token with blank $description", () => {
        const issues = run(group({
            primitive: group({ red: new ColorToken(color(), "  ") }),
        }));

        expect(issues).toHaveLength(1);
        expect(issues[0].tokenPath?.toString()).toBe("primitive.red");
    });

    it("accepts a token with $description", () => {
        const issues = run(group({
            primitive: group({ red: new ColorToken(color(), "Brand red") }),
        }));

        expect(issues).toEqual([]);
    });

    it("does not report groups without $description", () => {
        const issues = run(group({
            primitive: group({ red: new ColorToken(color(), "Brand red") }),
        }));

        expect(issues).toEqual([]);
    });

    it("warns about an alias token without $description", () => {
        const issues = run(group({
            semantic: group({ brand: new AliasToken(new TokenReference("primitive.red")) }),
        }));

        expect(issues).toHaveLength(1);
        expect(issues[0].tokenPath?.toString()).toBe("semantic.brand");
    });
});
