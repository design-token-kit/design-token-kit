import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { ReferenceCheck } from "#/core/check/checks/ReferenceCheck";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorValue } from "#/core/model/values/ColorValue";

function color(): ColorValue { return new ColorValue("srgb", [1, 0, 0], 1); }
function alias(path: string): AliasToken { return new AliasToken(new TokenReference(path)); }

function run(root: TokenGroup) {
    return new CheckRunner([new ReferenceCheck()]).runList(new DtcgList(new Dtcg(root)));
}

function group(children: Record<string, TokenGroup | TokenNode<unknown>>, extend?: string): TokenGroup {
    return new TokenGroup({
        children: new Map(Object.entries(children)),
        extends: extend === undefined ? undefined : new TokenReference(extend),
    });
}

describe("ReferenceCheck", () => {
    it("flags a reference to a missing token", () => {
        const issues = run(group({ brand: alias("missing") }));
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("bad-reference");
        expect(issues[0].message).toContain("{missing}");
    });

    it("flags a reference to a group", () => {
        const issues = run(group({
            palette: group({ red: new ColorToken(color()) }),
            brand: alias("palette"),
        }));
        expect(issues.map((i) => i.id)).toContain("ref-to-group");
    });

    it("flags a circular reference", () => {
        const issues = run(group({ a: alias("b"), b: alias("a") }));
        expect(issues.some((i) => i.id === "circular-reference")).toBe(true);
    });

    it("warns on a reference to a deprecated token", () => {
        const issues = run(group({
            old: new ColorToken(color(), undefined, true),
            brand: alias("old"),
        }));
        const deprecated = issues.find((i) => i.id === "deprecated-reference");
        expect(deprecated).toBeDefined();
        expect(deprecated?.severity).toBe("warning");
    });

    it("checks a group $extends reference", () => {
        const issues = run(group({ inner: group({}, "missing") }));
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("bad-reference");
    });

    it("accepts a valid reference", () => {
        const issues = run(group({
            red: new ColorToken(color()),
            brand: alias("red"),
        }));
        expect(issues).toEqual([]);
    });
});
