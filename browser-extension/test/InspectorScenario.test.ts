import { describe, expect, it } from "vitest";
import {
    CssTokenMap,
    CssTokenTracer,
    TokenLayers,
} from "@design-token-kit/core/browser";
import { CdpStylesAdapter } from "#/CdpStylesAdapter";
import type { CdpMatchedStyles } from "#/CdpStylesAdapter";
import demoMapJson from "./fixtures/demo.map.json";

describe("token inspector scenario", () => {
    it("traces a card through CDP styles and excludes browser defaults", () => {
        const parsedMap = CssTokenMap.fromJson(JSON.stringify(demoMapJson));
        if (!parsedMap.ok) throw new Error(parsedMap.reason);

        const matchedStyles: CdpMatchedStyles = {
            matchedCSSRules: [{
                rule: {
                    origin: "regular",
                    selectorList: { text: ".demo-card" },
                    style: {
                        cssProperties: [
                            { name: "background", value: "var(--component-card-bg)" },
                            { name: "padding", value: "var(--component-card-padding)" },
                        ],
                    },
                },
            }, {
                rule: {
                    origin: "user-agent",
                    selectorList: { text: "div" },
                    style: {
                        cssProperties: [
                            { name: "appearance", value: "auto" },
                        ],
                    },
                },
            }],
            inherited: [{
                matchedCSSRules: [{
                    rule: {
                        origin: "regular",
                        selectorList: { text: "body" },
                        style: {
                            cssProperties: [{
                                name: "color",
                                value: "var(--semantic-color-text-primary)",
                            }],
                        },
                    },
                }],
            }, {
                matchedCSSRules: [{
                    rule: {
                        origin: "regular",
                        selectorList: { text: ":root" },
                        style: {
                            cssProperties: [
                                {
                                    name: "--component-card-bg",
                                    value: "var(--semantic-color-background-surface)",
                                },
                                {
                                    name: "--semantic-color-background-surface",
                                    value: "var(--primitive-color-white)",
                                },
                                {
                                    name: "--primitive-color-white",
                                    value: "#ffffff",
                                },
                                {
                                    name: "--component-card-padding",
                                    value: "var(--primitive-dimension-space-800)",
                                },
                                {
                                    name: "--primitive-dimension-space-800",
                                    value: "32px",
                                },
                                {
                                    name: "--semantic-color-text-primary",
                                    value: "var(--primitive-color-slate-900)",
                                },
                                {
                                    name: "--primitive-color-slate-900",
                                    value: "#0f172a",
                                },
                            ],
                        },
                    },
                }],
            }],
        };

        const adapter = new CdpStylesAdapter();
        const styles = adapter.toElementStyles(
            "div.demo-card",
            matchedStyles,
            ["body", "html"],
        );
        const computed = adapter.toComputedValues([
            { name: "background-color", value: "rgb(255, 255, 255)" },
            { name: "padding-top", value: "32px" },
            { name: "color", value: "rgb(15, 23, 42)" },
            { name: "appearance", value: "auto" },
        ]);
        const traces = new CssTokenTracer(parsedMap.map, TokenLayers.default()).trace(styles, computed);

        expect(traces.map((trace) => trace.property)).toEqual([
            "padding",
            "background",
            "color",
        ]);
        expect(traces[1].chains[0].links.map((link) => link.token?.path.toString())).toEqual([
            "component.card.bg",
            "semantic.color.background.surface",
            "primitive.color.white",
        ]);
    });
});
