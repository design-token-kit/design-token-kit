import { describe, it, expect } from "vitest";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { BorderValue } from "#/core/model/values/BorderValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import type { TokenNode } from "#/core/model/TokenNode";
import { DtcgList } from "#/core/model/DtcgList";

function makeColor(alpha = 1): ColorValue {
    return new ColorValue("srgb", [1, 0, 0], alpha);
}

function makeDim(): DimensionValue { return new DimensionValue(1, "px"); }
function makeDuration(): DurationValue { return new DurationValue(100, "ms"); }

function makeDoc(children: Map<string, TokenGroup | TokenNode<unknown>>): Dtcg {
    return new Dtcg(new TokenGroup({ children }));
}

describe("Dtcg", () => {
    describe("basic API", () => {
        it("delegates get to root group", () => {
            const token = new ColorToken(makeColor());
            const doc = makeDoc(new Map([["red", token]]));
            expect(doc.get("red")).toBe(token);
        });

        it("returns undefined for missing key", () => {
            expect(new Dtcg(new TokenGroup()).get("missing")).toBeUndefined();
        });

        it("reports size", () => {
            const doc = makeDoc(new Map([["a", new ColorToken(makeColor())], ["b", new ColorToken(makeColor())]]));
            expect(doc.size).toBe(2);
        });

        it("iterates top-level keys", () => {
            const root = new TokenGroup({ children: new Map([["primitive", new TokenGroup()], ["semantic", new TokenGroup()]]) });
            expect([...new Dtcg(root).keys()]).toEqual(["primitive", "semantic"]);
        });
    });

    describe("validate - broken references", () => {
        it("returns empty array when no references exist", () => {
            expect(makeDoc(new Map([["red", new ColorToken(makeColor())]])).validate()).toEqual([]);
        });

        it("returns empty array when all references resolve", () => {
            const primitive = new TokenGroup({ children: new Map([["red", new ColorToken(makeColor())]]) });
            const semantic = new TokenGroup({ children: new Map([["brand", new ColorToken(new TokenReference("primitive.red"))]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive], ["semantic", semantic]]) });
            expect(new Dtcg(root).validate()).toEqual([]);
        });

        it("reports broken alias", () => {
            const issues = makeDoc(new Map([["brand", new ColorToken(new TokenReference("primitive.missing"))]])).validate();
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].tokenPath).toBe("brand");
            expect(issues[0].message).toContain("primitive.missing");
        });

        it("reports broken reference with nested path", () => {
            const inner = new TokenGroup({ children: new Map([["bg", new ColorToken(new TokenReference("primitive.missing"))]]) });
            const issues = new Dtcg(new TokenGroup({ children: new Map([["semantic", inner]]) })).validate();
            expect(issues[0].tokenPath).toBe("semantic.bg");
        });

        it("reports broken reference in BorderValue", () => {
            const border = new BorderValue(new TokenReference("primitive.missing"), makeDim(), "solid");
            expect(makeDoc(new Map([["b", new BorderToken(border)]])).validate()).toHaveLength(1);
        });

        it("reports broken reference in TransitionValue", () => {
            const t = new TransitionValue(new TokenReference("missing"), makeDuration(), new CubicBezierValue(0, 0, 1, 1));
            expect(makeDoc(new Map([["t", new TransitionToken(t)]])).validate()).toHaveLength(1);
        });

        it("reports broken reference in ShadowLayer", () => {
            const layer = new ShadowLayer(new TokenReference("missing"), makeDim(), makeDim(), makeDim(), makeDim());
            expect(makeDoc(new Map([["s", new ShadowToken(layer)]])).validate()).toHaveLength(1);
        });

        it("reports broken reference in multi-layer shadow", () => {
            const layer = new ShadowLayer(makeColor(), makeDim(), makeDim(), makeDim(), makeDim());
            expect(makeDoc(new Map([["s", new ShadowToken([layer, new TokenReference("missing")])]])).validate()).toHaveLength(1);
        });

        it("reports broken reference in GradientStop", () => {
            expect(makeDoc(new Map([["g", new GradientToken([new GradientStop(new TokenReference("missing"), 0)])]])).validate()).toHaveLength(1);
        });

        it("reports broken reference in TypographyValue", () => {
            const typo = new TypographyValue(new TokenReference("missing"), makeDim(), "regular", makeDim(), 1.5);
            expect(makeDoc(new Map([["ty", new TypographyToken(typo)]])).validate()).toHaveLength(1);
        });

        it("reports broken group $extends", () => {
            const inner = new TokenGroup({ extends: new TokenReference("primitive.missing") });
            const issues = new Dtcg(new TokenGroup({ children: new Map([["s", inner]]) })).validate();
            expect(issues[0].message).toContain("primitive.missing");
        });

        it("reports multiple issues", () => {
            const doc = makeDoc(new Map([
                ["a", new NumberToken(new TokenReference("missing.a"))],
                ["b", new NumberToken(new TokenReference("missing.b"))],
            ]));
            expect(doc.validate()).toHaveLength(2);
        });
    });

    describe("validate - reference target kind", () => {
        it("reports reference to a group instead of a token", () => {
            const group = new TokenGroup({ children: new Map([["red", new ColorToken(makeColor())]]) });
            const children = new Map<string, TokenGroup | ColorToken>([
                ["palette", group],
                ["brand", new ColorToken(new TokenReference("palette"))],
            ]);
            const doc = new Dtcg(new TokenGroup({ children }));
            const issues = doc.validate();
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].message).toContain("group, not a token");
        });
    });

    describe("validate - type mismatch", () => {
        it("reports type mismatch when color references dimension", () => {
            const doc = makeDoc(new Map<string, DimensionToken | ColorToken>([
                ["spacing", new DimensionToken(makeDim())],
                ["color", new ColorToken(new TokenReference("spacing"))],
            ]));
            const issues = doc.validate();
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].message).toContain("type mismatch");
            expect(issues[0].message).toContain("color");
            expect(issues[0].message).toContain("dimension");
        });

        it("does not report mismatch for alias token without explicit type", () => {
            const doc = makeDoc(new Map([
                ["src", new ColorToken(makeColor())],
                ["alias", new AliasToken(new TokenReference("src"))],
            ]));
            expect(doc.validate()).toHaveLength(0);
        });

        it("does not report mismatch when types match", () => {
            const doc = makeDoc(new Map([
                ["src", new ColorToken(makeColor())],
                ["alias", new ColorToken(new TokenReference("src"))],
            ]));
            expect(doc.validate()).toHaveLength(0);
        });
    });


    describe("validate - gradient", () => {
        it("reports duplicate stop positions", () => {
            const stops = [new GradientStop(makeColor(), 0.5), new GradientStop(makeColor(), 0.5)];
            expect(makeDoc(new Map([["g", new GradientToken(stops)]])).validate()[0].message).toContain("duplicate");
        });

        it("accepts valid gradient", () => {
            const stops = [new GradientStop(makeColor(), 0), new GradientStop(makeColor(), 1)];
            expect(makeDoc(new Map([["g", new GradientToken(stops)]])).validate()).toHaveLength(0);
        });
    });

    describe("validate - circular references", () => {
        it("detects self-reference a -> a", () => {
            const issues = makeDoc(new Map([["a", new ColorToken(new TokenReference("a"))]])).validate();
            expect(issues.some(i => i.severity === "error" && i.message.includes("circular"))).toBe(true);
        });

        it("detects two-token cycle a -> b -> a", () => {
            const doc = makeDoc(new Map([
                ["a", new NumberToken(new TokenReference("b"))],
                ["b", new NumberToken(new TokenReference("a"))],
            ]));
            expect(doc.validate().some(i => i.message.includes("circular"))).toBe(true);
        });
    });

    describe("validate - deprecated references", () => {
        it("warns when referencing a deprecated token", () => {
            const doc = makeDoc(new Map([
                ["old", new ColorToken(makeColor(), "old", true)],
                ["new", new ColorToken(new TokenReference("old"))],
            ]));
            const issues = doc.validate();
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("warning");
            expect(issues[0].message).toContain("deprecated");
        });

        it("does not warn for non-deprecated references", () => {
            const doc = makeDoc(new Map([
                ["src", new ColorToken(makeColor())],
                ["alias", new ColorToken(new TokenReference("src"))],
            ]));
            expect(doc.validate()).toHaveLength(0);
        });
    });

    describe("validate - valid document", () => {
        it("reports no issues", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0]));
            const root = new TokenGroup({ children: new Map([["red", token]]) });
            expect(new Dtcg(root).validate()).toEqual([]);
        });

        it("resolves theme references against the base document", () => {
            const base = new Dtcg(new TokenGroup({
                children: new Map([
                    ["primitive", new TokenGroup({
                        children: new Map([
                            ["color", new TokenGroup({
                                children: new Map([
                                    ["white", new ColorToken(makeColor())],
                                ]),
                            })],
                        ]),
                    })],
                ]),
            }));
            const theme = new Dtcg(new TokenGroup({
                children: new Map([
                    ["semantic", new TokenGroup({
                        children: new Map([
                            ["text", new TokenGroup({
                                children: new Map([
                                    ["default", new AliasToken(new TokenReference("primitive.color.white"))],
                                ]),
                            })],
                        ]),
                    })],
                ]),
            }));

            expect(new DtcgList(base, new Map([["dark", theme]])).validate()).toEqual([]);
        });
    });
});
