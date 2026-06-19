import { describe, it, expect } from "vitest";
import { CheckRunner } from "#/core/check/CheckRunner";
import { TokenLayers } from "#/core/check/TokenLayers";
import { LayerReferenceCheck } from "#/core/check/checks/LayerReferenceCheck";
import { RawValueUsageCheck } from "#/core/check/checks/RawValueUsageCheck";
import { validationChecks } from "#/core/check/checks/Checks";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
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

function color(alpha = 1): ColorValue { return new ColorValue("srgb", [1, 0, 0], alpha); }
function alias(path: string): AliasToken { return new AliasToken(new TokenReference(path)); }
function dim(): DimensionValue { return new DimensionValue(1, "px"); }
function duration(): DurationValue { return new DurationValue(100, "ms"); }

function group(children: Record<string, TokenGroup | TokenNode<unknown>>): TokenGroup {
    return new TokenGroup({ children: new Map(Object.entries(children)) });
}

function doc(children: Record<string, TokenGroup | TokenNode<unknown>>, source?: string): Dtcg {
    return new Dtcg(group(children), source);
}

function runAll(d: Dtcg) {
    const runner = new CheckRunner(
        [new LayerReferenceCheck(), new RawValueUsageCheck()],
        TokenLayers.default(),
    );
    return runner.runList(new DtcgList(d));
}

function validate(d: Dtcg, base?: Dtcg) {
    return new CheckRunner(validationChecks()).run(d, base);
}

describe("CheckRunner", () => {
    it("returns no issues for a valid layered model", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            semantic: group({ brand: alias("primitive.red") }),
            component: group({ button: alias("semantic.brand") }),
        });
        expect(runAll(d)).toEqual([]);
    });

    it("flags a component referencing a primitive directly", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            component: group({ button: alias("primitive.red") }),
        });
        const issues = runAll(d);
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("layer-reference");
        expect(issues[0].tokenPath?.toString()).toBe("component.button");
    });

    it("flags an upward reference (semantic -> component)", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            semantic: group({ brand: alias("component.button") }),
            component: group({ button: alias("semantic.brand") }),
        });
        const ids = runAll(d).filter((i) => i.tokenPath?.toString() === "semantic.brand").map((i) => i.id);
        expect(ids).toContain("layer-reference");
    });

    it("flags a same-level reference (component -> component)", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            semantic: group({ brand: alias("primitive.red") }),
            component: group({ a: alias("component.b"), b: alias("semantic.brand") }),
        });
        const issues = runAll(d).filter((i) => i.tokenPath?.toString() === "component.a");
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("layer-reference");
    });

    it("flags a raw value in a semantic token", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            semantic: group({ brand: new ColorToken(color()) }),
        });
        const issues = runAll(d);
        expect(issues).toHaveLength(1);
        expect(issues[0].id).toBe("raw-value-usage");
        expect(issues[0].tokenPath?.toString()).toBe("semantic.brand");
    });

    it("allows raw values in primitives", () => {
        const d = doc({ primitive: group({ red: new ColorToken(color()) }) });
        expect(runAll(d)).toEqual([]);
    });

    it("resolves theme references against the base", () => {
        const base = doc({ primitive: group({ red: new ColorToken(color()) }) }, "base.json");
        const theme = doc({ component: group({ button: alias("primitive.red") }) }, "tokens.dark.json");
        const runner = new CheckRunner(
            [new LayerReferenceCheck(), new RawValueUsageCheck()],
            TokenLayers.default(),
        );
        const issues = runner.runList(new DtcgList(base, new Map([["dark", theme]])));
        const layer = issues.filter((i) => i.id === "layer-reference");
        expect(layer).toHaveLength(1);
        expect(layer[0].tokenPath?.toString()).toBe("component.button");
        expect(layer[0].sourcePath).toBe("tokens.dark.json");
    });

    it("runs only the checks it is given (allow-list at the caller)", () => {
        const d = doc({
            primitive: group({ red: new ColorToken(color()) }),
            semantic: group({ brand: new ColorToken(color()) }),
            component: group({ button: alias("primitive.red") }),
        });
        const runner = new CheckRunner([new LayerReferenceCheck()], TokenLayers.default());
        const issues = runner.runList(new DtcgList(d));
        expect(issues.every((i) => i.id === "layer-reference")).toBe(true);
        expect(issues.some((i) => i.id === "raw-value-usage")).toBe(false);
    });
});

describe("validation checks", () => {
    describe("broken references", () => {
        it("returns empty array when no references exist", () => {
            expect(validate(doc({ red: new ColorToken(color()) }))).toEqual([]);
        });

        it("returns empty array when all references resolve", () => {
            const d = doc({
                primitive: group({ red: new ColorToken(color()) }),
                semantic: group({ brand: new ColorToken(new TokenReference("primitive.red")) }),
            });
            expect(validate(d)).toEqual([]);
        });

        it("reports broken alias", () => {
            const issues = validate(doc({ brand: new ColorToken(new TokenReference("primitive.missing")) }));
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].tokenPath?.toString()).toBe("brand");
            expect(issues[0].message).toContain("primitive.missing");
        });

        it("reports broken reference with nested path", () => {
            const d = doc({ semantic: group({ bg: new ColorToken(new TokenReference("primitive.missing")) }) });
            const issues = validate(d);
            expect(issues[0].tokenPath?.toString()).toBe("semantic.bg");
        });

        it("reports broken reference in BorderValue", () => {
            const border = new BorderValue(new TokenReference("primitive.missing"), dim(), "solid");
            expect(validate(doc({ b: new BorderToken(border) }))).toHaveLength(1);
        });

        it("reports broken reference in TransitionValue", () => {
            const t = new TransitionValue(new TokenReference("missing"), duration(), new CubicBezierValue(0, 0, 1, 1));
            expect(validate(doc({ t: new TransitionToken(t) }))).toHaveLength(1);
        });

        it("reports broken reference in ShadowLayer", () => {
            const layer = new ShadowLayer(new TokenReference("missing"), dim(), dim(), dim(), dim());
            expect(validate(doc({ s: new ShadowToken(layer) }))).toHaveLength(1);
        });

        it("reports broken reference in multi-layer shadow", () => {
            const layer = new ShadowLayer(color(), dim(), dim(), dim(), dim());
            expect(validate(doc({ s: new ShadowToken([layer, new TokenReference("missing")]) }))).toHaveLength(1);
        });

        it("reports broken reference in GradientStop", () => {
            expect(validate(doc({ g: new GradientToken([new GradientStop(new TokenReference("missing"), 0)]) }))).toHaveLength(1);
        });

        it("reports broken reference in TypographyValue", () => {
            const typo = new TypographyValue(new TokenReference("missing"), dim(), "regular", dim(), 1.5);
            expect(validate(doc({ ty: new TypographyToken(typo) }))).toHaveLength(1);
        });

        it("reports broken group $extends", () => {
            const inner = new TokenGroup({ extends: new TokenReference("primitive.missing") });
            const issues = validate(new Dtcg(group({ s: inner })));
            expect(issues[0].message).toContain("primitive.missing");
        });

        it("reports multiple issues", () => {
            const d = doc({
                a: new NumberToken(new TokenReference("missing.a")),
                b: new NumberToken(new TokenReference("missing.b")),
            });
            expect(validate(d)).toHaveLength(2);
        });
    });

    describe("reference target kind", () => {
        it("reports reference to a group instead of a token", () => {
            const d = doc({
                palette: group({ red: new ColorToken(color()) }),
                brand: new ColorToken(new TokenReference("palette")),
            });
            const issues = validate(d);
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].message).toContain("group, not a token");
        });
    });

    describe("type mismatch", () => {
        it("reports type mismatch when color references dimension", () => {
            const d = doc({
                spacing: new DimensionToken(dim()),
                color: new ColorToken(new TokenReference("spacing")),
            });
            const issues = validate(d);
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("error");
            expect(issues[0].message).toContain("type mismatch");
            expect(issues[0].message).toContain("color");
            expect(issues[0].message).toContain("dimension");
        });

        it("does not report mismatch for alias token without explicit type", () => {
            const d = doc({
                src: new ColorToken(color()),
                alias: new AliasToken(new TokenReference("src")),
            });
            expect(validate(d)).toHaveLength(0);
        });

        it("does not report mismatch when types match", () => {
            const d = doc({
                src: new ColorToken(color()),
                alias: new ColorToken(new TokenReference("src")),
            });
            expect(validate(d)).toHaveLength(0);
        });
    });

    describe("gradient", () => {
        it("reports duplicate stop positions", () => {
            const stops = [new GradientStop(color(), 0.5), new GradientStop(color(), 0.5)];
            expect(validate(doc({ g: new GradientToken(stops) }))[0].message).toContain("duplicate");
        });

        it("accepts valid gradient", () => {
            const stops = [new GradientStop(color(), 0), new GradientStop(color(), 1)];
            expect(validate(doc({ g: new GradientToken(stops) }))).toHaveLength(0);
        });
    });

    describe("circular references", () => {
        it("detects self-reference a -> a", () => {
            const issues = validate(doc({ a: new ColorToken(new TokenReference("a")) }));
            expect(issues.some(i => i.severity === "error" && i.message.includes("circular"))).toBe(true);
        });

        it("detects two-token cycle a -> b -> a", () => {
            const d = doc({
                a: new NumberToken(new TokenReference("b")),
                b: new NumberToken(new TokenReference("a")),
            });
            expect(validate(d).some(i => i.message.includes("circular"))).toBe(true);
        });
    });

    describe("deprecated references", () => {
        it("warns when referencing a deprecated token", () => {
            const d = doc({
                old: new ColorToken(color(), "old", true),
                new: new ColorToken(new TokenReference("old")),
            });
            const issues = validate(d);
            expect(issues).toHaveLength(1);
            expect(issues[0].severity).toBe("warning");
            expect(issues[0].message).toContain("deprecated");
        });

        it("does not warn for non-deprecated references", () => {
            const d = doc({
                src: new ColorToken(color()),
                alias: new ColorToken(new TokenReference("src")),
            });
            expect(validate(d)).toHaveLength(0);
        });
    });

    describe("valid document", () => {
        it("reports no issues", () => {
            const d = doc({ red: new ColorToken(new ColorValue("srgb", [1, 0, 0])) });
            expect(validate(d)).toEqual([]);
        });
    });
});
