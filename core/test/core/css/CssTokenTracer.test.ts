import { describe, expect, it } from "vitest";
import { TokenLayers } from "#/core/check/TokenLayers";
import { TokenPath } from "#/core/model/TokenPath";
import { CssTokenMap } from "#/core/platforms/css/CssTokenMap";
import {
    CssTokenTracer,
    type CssDeclaration,
    type CssElementStyles,
} from "#/core/platforms/css/CssTokenTracer";

describe("CssTokenTracer", () => {
    const tracer = new CssTokenTracer(new CssTokenMap([
        token("--component-card-background", "component.card.background"),
        token("--semantic-surface", "semantic.color.background.surface"),
        token("--primitive-white", "primitive.color.white"),
    ]), TokenLayers.default());

    it("follows a custom property chain and names token layers", () => {
        const trace = tracer.trace(element("div.card", [
            declaration("background", "var(--component-card-background)", ".card"),
            declaration("--component-card-background", "var(--semantic-surface)", ".card"),
            declaration("--semantic-surface", "var(--primitive-white)", ":root"),
            declaration("--primitive-white", "#ffffff", ":root"),
        ]), new Map([["background", "rgb(255, 255, 255)"]]));

        expect(trace).toEqual([{
            property: "background",
            declaration: declaration("background", "var(--component-card-background)", ".card"),
            inheritedFrom: undefined,
            chains: [{
                links: [
                    expect.objectContaining({
                        customProperty: "--component-card-background",
                        layer: "component",
                    }),
                    expect.objectContaining({
                        customProperty: "--semantic-surface",
                        layer: "semantic",
                    }),
                    expect.objectContaining({
                        customProperty: "--primitive-white",
                        layer: "primitive",
                    }),
                ],
                end: { kind: "value", value: "#ffffff" },
            }],
            computedValue: "rgb(255, 255, 255)",
        }]);
    });

    it("marks a declaration inherited from an ancestor", () => {
        const body = element("body", [
            declaration("color", "var(--semantic-surface)", "body"),
            declaration("--semantic-surface", "#111111", ":root"),
        ]);
        const trace = tracer.trace(element("span", [], body), new Map([["color", "rgb(17, 17, 17)"]]));

        expect(trace[0].inheritedFrom).toBe("body");
        expect(trace[0].chains[0].links[0].customProperty).toBe("--semantic-surface");
    });

    it("does not inherit non-inheritable properties from an ancestor", () => {
        const body = element("body", [
            declaration("padding", "var(--semantic-surface)", "body"),
            declaration("--semantic-surface", "24px", ":root"),
        ]);
        const trace = tracer.trace(element("span", [], body), new Map([["padding-top", "0px"]]));

        expect(trace).toEqual([]);
    });

    it("reports an undefined property and its fallback", () => {
        const trace = tracer.trace(element("div", [
            declaration("color", "var(--missing, #ffffff)", ".card"),
        ]), new Map([["color", "rgb(255, 255, 255)"]]));

        expect(trace[0].chains).toEqual([{
            links: [],
            end: {
                kind: "undefined",
                customProperty: "--missing",
                fallback: "#ffffff",
            },
        }]);
    });

    it("records the theme from the custom property declaration selector", () => {
        const trace = tracer.trace(element("div", [
            declaration("color", "var(--semantic-surface)", ".card"),
            declaration("--semantic-surface", "#000000", ':root[data-theme="dark"]'),
        ]), new Map([["color", "rgb(0, 0, 0)"]]));

        expect(trace[0].chains[0].links[0].theme).toBe("dark");
    });

    it("does not create a chain for literal values", () => {
        const trace = tracer.trace(element("div", [
            declaration("padding", "24px", ".card"),
        ]), new Map([["padding", "24px"]]));

        expect(trace[0].chains).toEqual([]);
    });

    it("traces authored shorthand declarations instead of computed longhands", () => {
        const trace = tracer.trace(element("div.card", [
            declaration("background", "var(--component-card-background)", ".card"),
            declaration("padding", "var(--semantic-surface)", ".card"),
        ]), new Map([
            ["background-color", "rgb(255, 255, 255)"],
            ["padding-top", "32px"],
        ]));

        expect(trace.map((propertyTrace) => propertyTrace.property)).toEqual([
            "background",
            "padding",
        ]);
        expect(trace.every((propertyTrace) => propertyTrace.chains.length === 1)).toBe(true);
        expect(trace.every((propertyTrace) => propertyTrace.computedValue === undefined)).toBe(true);
    });

    it("uses the declaration ordered first by the CSS adapter", () => {
        const trace = tracer.trace(element("div.card", [
            declaration("background", "var(--primitive-white)", ".card"),
            {
                ...declaration("background", "var(--component-card-background)", ".card.is-active"),
                important: true,
            },
            declaration("--primitive-white", "#ffffff", ":root"),
        ]), new Map([["background", "rgb(255, 255, 255)"]]));

        expect(trace[0].chains[0].links[0].customProperty).toBe("--primitive-white");
        expect(trace[0].declaration.important).toBe(false);
    });
});

function token(customProperty: string, path: string) {
    return {
        customProperty,
        path: TokenPath.parse(path),
        type: "color" as const,
        description: undefined,
        source: undefined,
    };
}

function declaration(property: string, value: string, selector: string): CssDeclaration {
    return {
        property,
        value,
        important: false,
        selector,
    };
}

function element(
    label: string,
    declarations: readonly CssDeclaration[],
    parent?: CssElementStyles,
): CssElementStyles {
    return {
        label,
        declarations,
        parent,
    };
}
