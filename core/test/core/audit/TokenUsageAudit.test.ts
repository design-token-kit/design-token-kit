import { describe, expect, it } from "vitest";
import { colorDistance } from "#/core/audit/color/ColorDistance";
import type { SrgbColor } from "#/core/audit/color/SrgbColor";
import { TokenMatcher } from "#/core/audit/usage/TokenMatcher";
import {
    auditUsageSamples,
    computeTokenCoverage,
    computeTokenUsageScore,
    formatUsageValue,
    listTokenUsageRules,
} from "#/core/audit/usage/TokenUsageAudit";
import type { TokenBinding, TokenCandidate, UsageSample, UsageValue } from "#/core/audit/usage/UsageSample";

function color(hex: string, alpha = 1): UsageValue {
    return { type: "color", color: rgb(hex, alpha) };
}

function rgb(hex: string, alpha = 1): SrgbColor {
    const [red, green, blue] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return { red, green, blue, alpha };
}

function px(value: number): UsageValue {
    return { type: "dimension", px: value };
}

function candidate(name: string, value: UsageValue, extra: Partial<TokenCandidate> = {}): TokenCandidate {
    const layer = name.split("/")[0];
    return { kind: "variable", name, layer: ["primitive", "semantic", "component"].includes(layer) ? layer : undefined, value, ...extra };
}

function fill(
    value: UsageValue,
    binding?: TokenBinding,
    variableModes?: Readonly<Record<string, string>>,
): UsageSample {
    return { id: "1:1#fill", label: "Card", property: "fill", value, binding, variableModes };
}

const TOKENS: TokenCandidate[] = [
    candidate("primitive/blue/500", color("#2563eb")),
    candidate("semantic/accent", color("#2563eb")),
    candidate("component/button/background", color("#2563eb")),
    candidate("primitive/gray/900", color("#111827")),
    candidate("primitive/space/4", px(16), { properties: ["gap", "padding"] }),
    candidate("primitive/radius/md", px(8), { properties: ["corner-radius"] }),
];

describe("colorDistance", () => {
    it("is 0 for equal colors and about 1 between black and white", () => {
        expect(colorDistance(rgb("#2563eb"), rgb("#2563eb"))).toBe(0);
        expect(colorDistance(rgb("#000000"), rgb("#ffffff"))).toBeCloseTo(1, 3);
    });
});

describe("TokenMatcher", () => {
    const matcher = new TokenMatcher(TOKENS);

    it("prefers a semantic token over a primitive and a component one", () => {
        expect(matcher.match("fill", color("#2563eb"))).toEqual({ candidate: TOKENS[1], exact: true });
    });

    it("matches a color within the tolerance as close", () => {
        expect(matcher.match("fill", color("#2564ea"))).toEqual({ candidate: TOKENS[1], exact: false });
        expect(matcher.match("fill", color("#3b82f6"))).toBeUndefined();
    });

    it("does not match colors with a different alpha", () => {
        expect(matcher.match("fill", color("#2563eb", 0.5))).toBeUndefined();
    });

    it("matches dimensions within 1px, only for the properties a token is meant for", () => {
        expect(matcher.match("padding", px(16))).toEqual({ candidate: TOKENS[4], exact: true });
        expect(matcher.match("gap", px(15))).toEqual({ candidate: TOKENS[4], exact: false });
        expect(matcher.match("gap", px(14))).toBeUndefined();
        expect(matcher.match("corner-radius", px(16))).toBeUndefined();
    });

    it("prefers an exact match over a closer layer", () => {
        const tokens = [candidate("semantic/near", color("#2564ea")), candidate("primitive/exact", color("#2563eb"))];
        expect(new TokenMatcher(tokens).match("fill", color("#2563eb"))?.candidate.name).toBe("primitive/exact");
    });

    it("follows the configured layers", () => {
        const tokens = [candidate("base/blue", color("#2563eb"), { layer: "base" }), candidate("role/accent", color("#2563eb"), { layer: "role" })];
        expect(new TokenMatcher(tokens, { layers: ["base", "role"] }).match("fill", color("#2563eb"))?.candidate.name).toBe("role/accent");
    });

    it("matches variables only in the sample mode context while keeping styles mode-independent", () => {
        const light = { theme: "light" };
        const dark = { theme: "dark" };
        const candidates = [
            candidate("semantic/surface", color("#ffffff"), { variableModes: light }),
            candidate("semantic/surface", color("#111111"), { variableModes: dark }),
            { kind: "style" as const, name: "Surface style", value: color("#ffffff") },
        ];
        const matcher = new TokenMatcher(candidates);

        expect(matcher.match("fill", color("#111111"), undefined, dark)?.candidate.name).toBe("semantic/surface");
        expect(matcher.match("fill", color("#ffffff"), undefined, dark)?.candidate.name).toBe("Surface style");
        expect(matcher.match("fill", color("#ffffff"), undefined)?.candidate.name).toBe("Surface style");
    });
});

describe("auditUsageSamples", () => {
    it("lists its rules", () => {
        expect(listTokenUsageRules().map((rule) => [rule.id, rule.category, rule.severity])).toEqual([
            ["hardcoded-value", "token-usage", "warning"],
            ["primitive-binding", "token-usage", "warning"],
        ]);
    });

    it("reports a hard-coded value with the token to use", () => {
        const { findings } = auditUsageSamples([fill(color("#2563eb"))], TOKENS);
        expect(findings).toEqual([{
            id: "hardcoded-value",
            category: "token-usage",
            severity: "warning",
            message: "Card: fill #2563eb is not bound to a token; use semantic/accent.",
            subjectId: "1:1#fill",
            measurement: "#2563eb",
            suggestion: { name: "semantic/accent", exact: true },
        }]);
    });

    it("does not suggest an exact variable from an inactive mode", () => {
        const candidates = [
            candidate("semantic/surface", color("#ffffff"), { variableModes: { theme: "light" } }),
            candidate("semantic/surface", color("#111111"), { variableModes: { theme: "dark" } }),
        ];
        const [finding] = auditUsageSamples([fill(color("#ffffff"), undefined, { theme: "dark" })], candidates).findings;

        expect(finding.message).toBe("Card: fill #ffffff is not bound to a token; no token has this value.");
        expect(finding.suggestion).toBeUndefined();
    });

    it("reports a hard-coded value no token has", () => {
        const sample: UsageSample = { id: "1:1#padding-top", label: "Card", property: "padding", part: "top", value: px(13) };
        const [finding] = auditUsageSamples([sample], TOKENS).findings;
        expect(finding.message).toBe("Card: padding (top) 13px is not bound to a token; no token has this value.");
        expect(finding.suggestion).toBeUndefined();
    });

    it("reports a primitive binding when higher layers exist, suggesting a higher-layer token", () => {
        const binding: TokenBinding = { kind: "variable", name: "primitive/blue/500", layer: "primitive" };
        const [finding] = auditUsageSamples([fill(color("#2563eb"), binding)], TOKENS).findings;
        expect(finding).toMatchObject({
            id: "primitive-binding",
            message: "Card: fill is bound to the primitive token primitive/blue/500; use semantic/accent.",
            measurement: "primitive/blue/500",
            suggestion: { name: "semantic/accent", exact: true },
        });
    });

    it("accepts a primitive binding when there are only primitives", () => {
        const binding: TokenBinding = { kind: "variable", name: "primitive/blue/500", layer: "primitive" };
        const primitives = TOKENS.filter((token) => token.layer === "primitive");
        expect(auditUsageSamples([fill(color("#2563eb"), binding)], primitives).findings).toEqual([]);
    });

    it("does not use an unrelated higher-layer property as a primitive warning", () => {
        const sample: UsageSample = {
            id: "1:1#gap",
            label: "Card",
            property: "gap",
            value: px(16),
            binding: { kind: "variable", name: "primitive/space/4", layer: "primitive" },
        };
        const candidates = [
            candidate("primitive/space/4", px(16), { properties: ["gap"] }),
            candidate("semantic/text/primary", color("#111111"), { properties: ["fill"] }),
        ];

        expect(auditUsageSamples([sample], candidates).findings).toEqual([]);
    });

    it("accepts semantic bindings and bindings without a layer", () => {
        const samples = [
            fill(color("#2563eb"), { kind: "variable", name: "semantic/accent", layer: "semantic" }),
            fill(color("#2563eb"), { kind: "style", name: "Brand/Accent" }),
        ];
        expect(auditUsageSamples(samples, TOKENS).findings).toEqual([]);
    });

    it("runs only the allowed rules", () => {
        expect(auditUsageSamples([fill(color("#2563eb"))], TOKENS, { rules: ["primitive-binding"] }).findings).toEqual([]);
    });
});

describe("computeTokenUsageScore", () => {
    it("scores the share of properties without a finding, rounded down", () => {
        const samples = [fill(color("#2563eb")), fill(color("#2563eb"), { kind: "variable", name: "semantic/accent", layer: "semantic" }),
            fill(color("#2563eb"), { kind: "style", name: "Brand" })];
        expect(auditUsageSamples(samples, TOKENS).score).toEqual({ score: 66, grade: "D", clean: 2, total: 3 });
    });

    it("counts a property once and has no score when nothing was audited", () => {
        const finding = auditUsageSamples([fill(color("#2563eb"))], TOKENS).findings[0];
        expect(computeTokenUsageScore(2, [finding, finding])).toEqual({ score: 50, grade: "F", clean: 1, total: 2 });
        expect(computeTokenUsageScore(0, [])).toBeUndefined();
    });
});

describe("computeTokenCoverage", () => {
    it("counts bound properties in total and per property", () => {
        const bound: TokenBinding = { kind: "variable", name: "semantic/accent" };
        const coverage = computeTokenCoverage([
            fill(color("#2563eb"), bound),
            fill(color("#2563eb")),
            fill(color("#2563eb")),
            { id: "1:1#gap", label: "Card", property: "gap", value: px(8), binding: bound },
        ]);
        expect(coverage).toEqual({
            total: 4,
            bound: 2,
            percent: 50,
            byProperty: { fill: { total: 3, bound: 1 }, gap: { total: 1, bound: 1 } },
        });
    });

    it("has no percent when nothing was audited", () => {
        expect(computeTokenCoverage([]).percent).toBeUndefined();
    });
});

describe("formatUsageValue", () => {
    it("formats colors as hex and dimensions in px", () => {
        expect(formatUsageValue(color("#2563eb", 0.5))).toBe("#2563eb80");
        expect(formatUsageValue(px(10.5))).toBe("10.5px");
    });
});
