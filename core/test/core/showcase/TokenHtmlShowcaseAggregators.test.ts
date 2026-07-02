import { describe, it, expect } from "vitest";
import {
    BorderTokenAggregator,
    FontCollectionAggregator,
    GradientTokenAggregator,
    ShadowTokenAggregator,
    TransitionTokenAggregator,
    TypographyTokenAggregator,
} from "#/core/showcase/TokenHtmlShowcaseAggregators";
import type { TokenEntry } from "#/core/showcase/CssTokenParser";

function token(name: string, value: string): TokenEntry {
    return { name, value };
}

describe("TypographyTokenAggregator", () => {
    const aggregator = new TypographyTokenAggregator();

    it("combines fontSize, fontWeight, lineHeight, letterSpacing and fontFamily into one entry", () => {
        const tokens = [
            token("--primitive-typography-body-md-fontSize", "16px"),
            token("--primitive-typography-body-md-fontWeight", "500"),
            token("--primitive-typography-body-md-lineHeight", "1.5"),
            token("--primitive-typography-body-md-letterSpacing", "0px"),
            token("--primitive-typography-body-md-fontFamily-0", "Inter"),
            token("--primitive-typography-body-md-fontFamily-1", "Arial"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("--primitive-typography-body-md");
        expect(result[0].typography?.size).toBe("16px");
        expect(result[0].typography?.weight).toBe("500");
        expect(result[0].typography?.lineHeight).toBe("1.5");
        expect(result[0].typography?.letterSpacing).toBe("0px");
        expect(result[0].typography?.family).toBe("Inter, Arial");
    });

    it("formats value as 'weight size/lineHeight family'", () => {
        const tokens = [
            token("--t-body-fontSize", "14px"),
            token("--t-body-fontWeight", "400"),
            token("--t-body-lineHeight", "1.4"),
            token("--t-body-fontFamily-0", "Inter"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result[0].value).toBe("400 14px/1.4 Inter");
    });

    it("appends letter-spacing to value with semicolon separator", () => {
        const tokens = [
            token("--t-caption-fontSize", "11px"),
            token("--t-caption-letterSpacing", "0.5px"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result[0].value).toContain("letter-spacing 0.5px");
    });

    it("passes through tokens that do not match typography patterns", () => {
        const tokens = [token("--semantic-text-body", "var(--primitive-typography-body-md)")];
        const result = aggregator.aggregate(tokens);
        expect(result[0].name).toBe("--semantic-text-body");
        expect(result[0].value).toBe("var(--primitive-typography-body-md)");
        expect(result[0].typography).toBeUndefined();
    });

    it("returns entries sorted by name", () => {
        const tokens = [
            token("--t-z-fontSize", "20px"),
            token("--t-a-fontSize", "12px"),
        ];
        const names = aggregator.aggregate(tokens).map((r) => r.name);
        expect(names[0]).toBe("--t-a");
        expect(names[1]).toBe("--t-z");
    });
});

describe("FontCollectionAggregator", () => {
    const aggregator = new FontCollectionAggregator();

    it("groups tokens into font-family, font-size, font-weight collections", () => {
        const tokens = [
            token("--primitive-font-family-0", "Inter"),
            token("--primitive-font-size-md", "16px"),
            token("--primitive-font-weight-bold", "700"),
        ];
        const result = aggregator.aggregate(tokens);
        const keys = result.map((c) => c.key);
        expect(keys).toContain("font-family");
        expect(keys).toContain("font-size");
        expect(keys).toContain("font-weight");
    });

    it("uses canonical titles for known keys", () => {
        const tokens = [token("--primitive-font-family-0", "Inter")];
        const result = aggregator.aggregate(tokens);
        expect(result[0].title).toBe("font family");
    });

    it("sorts font-size entries numerically ascending", () => {
        const tokens = [
            token("--font-size-xl", "24px"),
            token("--font-size-sm", "12px"),
            token("--font-size-md", "16px"),
        ];
        const result = aggregator.aggregate(tokens);
        const sizes = result.find((c) => c.key === "font-size")!.entries.map((e) => e.value);
        expect(sizes).toEqual(["12px", "16px", "24px"]);
    });

    it("sorts font-weight entries numerically ascending", () => {
        const tokens = [
            token("--font-weight-bold", "700"),
            token("--font-weight-regular", "400"),
        ];
        const result = aggregator.aggregate(tokens);
        const weights = result.find((c) => c.key === "font-weight")!.entries.map((e) => e.value);
        expect(weights).toEqual(["400", "700"]);
    });

    it("puts unrecognized tokens in other collection", () => {
        const tokens = [token("--font-display-swap", "swap")];
        const result = aggregator.aggregate(tokens);
        expect(result.find((c) => c.key === "other")).toBeDefined();
    });

    it("returns empty array for empty input", () => {
        expect(aggregator.aggregate([])).toHaveLength(0);
    });

    it("respects collection order: family, weight, size, line-height, letter-spacing, other", () => {
        const tokens = [
            token("--primitive-letter-spacing-md", "0.5px"),
            token("--primitive-line-height-md", "1.5"),
            token("--primitive-font-size-md", "16px"),
            token("--primitive-font-weight-regular", "400"),
            token("--primitive-font-family-0", "Inter"),
        ];
        const keys = aggregator.aggregate(tokens).map((c) => c.key);
        expect(keys).toEqual(["font-family", "font-weight", "font-size", "line-height", "letter-spacing"]);
    });
});

describe("BorderTokenAggregator", () => {
    const aggregator = new BorderTokenAggregator();

    it("aggregates border token with color, width and style into BorderTokenInfo", () => {
        const tokens = [
            token("--primitive-border-focus-ring", "2px solid #000"),
            token("--primitive-border-focus-ring-color", "#000"),
            token("--primitive-border-focus-ring-width", "2px"),
            token("--primitive-border-focus-ring-style", "solid"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.borders).toHaveLength(1);
        const border = result.borders[0];
        expect(border.name).toBe("primitive-border-focus-ring");
        expect(border.value).toBe("2px solid #000");
        expect(border.color).toBe("#000");
        expect(border.width).toBe("2px");
        expect(border.style).toBe("solid");
    });

    it("separates border-width tokens", () => {
        const tokens = [
            token("--primitive-border-width-sm", "1px"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.borderWidths).toHaveLength(1);
        expect(result.borderWidths[0].value).toBe("1px");
    });

    it("aggregates stroke-style tokens", () => {
        const tokens = [
            token("--primitive-stroke-style-dashed", "dashed"),
            token("--primitive-stroke-style-dashed-dashArray-0", "4px"),
            token("--primitive-stroke-style-dashed-dashArray-1", "2px"),
            token("--primitive-stroke-style-dashed-lineCap", "round"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.strokeStyles).toHaveLength(1);
        expect(result.strokeStyles[0].dashArray).toEqual(["4px", "2px"]);
        expect(result.strokeStyles[0].lineCap).toBe("round");
    });

    it("puts unrecognized border tokens into fallback", () => {
        const tokens = [token("--semantic-outline-focus", "var(--x)")];
        const result = aggregator.aggregate(tokens);
        expect(result.fallback.map((e) => e.name)).toContain("--semantic-outline-focus");
    });

    it("returns empty collections for empty input", () => {
        const result = aggregator.aggregate([]);
        expect(result.borders).toHaveLength(0);
        expect(result.borderWidths).toHaveLength(0);
        expect(result.strokeStyles).toHaveLength(0);
        expect(result.fallback).toHaveLength(0);
    });
});

describe("ShadowTokenAggregator", () => {
    const aggregator = new ShadowTokenAggregator();

    it("aggregates single-layer shadow from component tokens", () => {
        const tokens = [
            token("--primitive-shadow-md", "0 4px 8px rgba(0,0,0,.2)"),
            token("--primitive-shadow-md-offsetX", "0px"),
            token("--primitive-shadow-md-offsetY", "4px"),
            token("--primitive-shadow-md-blur", "8px"),
            token("--primitive-shadow-md-spread", "0px"),
            token("--primitive-shadow-md-color", "rgba(0,0,0,.2)"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items).toHaveLength(1);
        const shadow = result.items[0];
        expect(shadow.name).toBe("primitive-shadow-md");
        expect(shadow.value).toBe("0 4px 8px rgba(0,0,0,.2)");
        expect(shadow.layers[0].offsetX).toBe("0px");
        expect(shadow.layers[0].color).toBe("rgba(0,0,0,.2)");
    });

    it("aggregates multi-layer shadow by numeric index", () => {
        const tokens = [
            token("--primitive-shadow-elevated", "0 2px 4px #000, 0 8px 16px #555"),
            token("--primitive-shadow-elevated-0-offsetX", "0px"),
            token("--primitive-shadow-elevated-0-color", "#000"),
            token("--primitive-shadow-elevated-1-offsetX", "0px"),
            token("--primitive-shadow-elevated-1-color", "#555"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items[0].layers).toHaveLength(2);
        expect(result.items[0].layers[0].color).toBe("#000");
        expect(result.items[0].layers[1].color).toBe("#555");
    });

    it("puts shadow tokens without value in fallback", () => {
        const tokens = [token("--primitive-shadow-md-color", "#000")];
        const result = aggregator.aggregate(tokens);
        expect(result.fallback).toHaveLength(1);
    });

    it("returns empty items for empty input", () => {
        const result = aggregator.aggregate([]);
        expect(result.items).toHaveLength(0);
        expect(result.fallback).toHaveLength(0);
    });
});

describe("GradientTokenAggregator", () => {
    const aggregator = new GradientTokenAggregator();

    it("aggregates gradient stops by index", () => {
        const tokens = [
            token("--primitive-gradient-brand", "linear-gradient(90deg, #2549f6 0%, #1d39da 100%)"),
            token("--primitive-gradient-brand-0-color", "#2549f6"),
            token("--primitive-gradient-brand-0-position", "0"),
            token("--primitive-gradient-brand-1-color", "#1d39da"),
            token("--primitive-gradient-brand-1-position", "1"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items).toHaveLength(1);
        const grad = result.items[0];
        expect(grad.name).toBe("primitive-gradient-brand");
        expect(grad.stops).toHaveLength(2);
        expect(grad.stops[0].color).toBe("#2549f6");
        expect(grad.stops[1].position).toBe("1");
    });

    it("puts gradient value token in fallback when no stops have color", () => {
        const tokens = [
            token("--primitive-gradient-brand", "linear-gradient(...)"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items).toHaveLength(0);
        expect(result.fallback).toHaveLength(1);
    });

    it("returns empty collections for empty input", () => {
        const result = aggregator.aggregate([]);
        expect(result.items).toHaveLength(0);
        expect(result.fallback).toHaveLength(0);
    });
});

describe("TransitionTokenAggregator", () => {
    const aggregator = new TransitionTokenAggregator();

    it("aggregates transition with duration, delay and timingFunction", () => {
        const tokens = [
            token("--primitive-transition-fast", "150ms ease 0ms"),
            token("--primitive-transition-fast-duration", "150ms"),
            token("--primitive-transition-fast-delay", "0ms"),
            token("--primitive-transition-fast-timingFunction-0", "ease"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items).toHaveLength(1);
        const t = result.items[0];
        expect(t.name).toBe("primitive-transition-fast");
        expect(t.duration).toBe("150ms");
        expect(t.delay).toBe("0ms");
        expect(t.timingFunction).toEqual(["ease"]);
    });

    it("includes transition with only duration (no value required)", () => {
        const tokens = [
            token("--primitive-transition-fast-duration", "200ms"),
        ];
        const result = aggregator.aggregate(tokens);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].duration).toBe("200ms");
    });

    it("puts non-transition tokens in fallback", () => {
        const tokens = [token("--semantic-motion-scale", "1.05")];
        const result = aggregator.aggregate(tokens);
        expect(result.fallback.map((e) => e.name)).toContain("--semantic-motion-scale");
    });

    it("returns empty collections for empty input", () => {
        const result = aggregator.aggregate([]);
        expect(result.items).toHaveLength(0);
        expect(result.fallback).toHaveLength(0);
    });

    it("returns items sorted by name", () => {
        const tokens = [
            token("--primitive-transition-slow-duration", "500ms"),
            token("--primitive-transition-fast-duration", "100ms"),
        ];
        const names = aggregator.aggregate(tokens).items.map((i) => i.name);
        expect(names[0]).toBe("primitive-transition-fast");
        expect(names[1]).toBe("primitive-transition-slow");
    });
});
