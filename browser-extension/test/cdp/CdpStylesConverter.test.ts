import type { CssElementStyles } from "@design-token-kit/core/core/platforms/css/CssTokenTracer";
import { describe, expect, it } from "vitest";
import { toElementStyles } from "#/browser-extension/cdp/CdpStylesConverter";
import type { CdpMatchedStyles, CdpRuleMatch } from "#/browser-extension/cdp/CdpTypes";

const matched: CdpMatchedStyles = {
    inlineStyle: {
        cssProperties: [{ name: "margin", value: "0", text: "margin: 0" }],
    },
    matchedCSSRules: [
        {
            rule: {
                selectorList: { text: "div", selectors: [{ text: "div" }] },
                origin: "user-agent",
                style: { cssProperties: [{ name: "display", value: "block" }] },
            },
            matchingSelectors: [0],
        },
        {
            rule: {
                selectorList: { text: ".card", selectors: [{ text: ".card" }] },
                origin: "regular",
                style: {
                    cssProperties: [
                        { name: "padding", value: "24px", text: "padding: 24px;" },
                        { name: "padding-top", value: "24px" },
                        { name: "background", value: "red", text: "background: red;" },
                        {
                            name: "background",
                            value: "var(--card-bg)",
                            text: "background: var(--card-bg);",
                        },
                        { name: "color", value: "blue", text: "/* color: blue; */", disabled: true },
                        { name: "colr", value: "blue", text: "colr: blue;", parsedOk: false },
                    ],
                },
            },
            matchingSelectors: [0],
        },
        {
            rule: {
                selectorList: { text: ".card.wide", selectors: [{ text: ".card.wide" }] },
                origin: "regular",
                style: {
                    cssProperties: [
                        {
                            name: "padding",
                            value: "32px",
                            important: true,
                            text: "padding: 32px !important;",
                        },
                    ],
                },
            },
            matchingSelectors: [0],
        },
    ],
    inherited: [
        { matchedCSSRules: [] },
        {
            matchedCSSRules: [
                {
                    rule: {
                        selectorList: { text: ":root", selectors: [{ text: ":root" }] },
                        origin: "regular",
                        style: {
                            cssProperties: [
                                { name: "--card-fg", value: "#000", text: "--card-fg: #000;" },
                                { name: "--card-bg", value: "#fff", text: "--card-bg: #fff;" },
                            ],
                        },
                    },
                    matchingSelectors: [0],
                },
            ],
        },
    ],
};

describe("toElementStyles", () => {
    const styles: CssElementStyles = toElementStyles(matched, { element: "div.card", ancestors: ["body", "html"] });

    it("orders own declarations from the winning one: inline, later rules, later declarations", () => {
        const lines: string[] = styles.declarations
            .map((declaration) => `${declaration.selector} ${declaration.property}: ${declaration.value}`);
        expect(lines).toEqual([
            "element.style margin: 0",
            ".card.wide padding: 32px",
            ".card background: var(--card-bg)",
            ".card background: red",
            ".card padding: 24px",
        ]);
        expect(styles.declarations[1].important).toBe(true);
    });

    it("skips user-agent rules, expanded longhands, disabled and invalid declarations", () => {
        const properties: string[] = styles.declarations.map((declaration) => declaration.property);
        expect(properties).not.toContain("display");
        expect(properties).not.toContain("padding-top");
        expect(properties).not.toContain("color");
        expect(properties).not.toContain("colr");
    });

    it("links ancestors from the parent up with their labels", () => {
        expect(styles.label).toBe("div.card");
        expect(styles.parent?.label).toBe("body");
        expect(styles.parent?.parent?.label).toBe("html");
        expect(styles.parent?.parent?.declarations.map((declaration) => declaration.property)).toEqual([
            "--card-bg",
            "--card-fg",
        ]);
        expect(styles.parent?.parent?.parent).toBeUndefined();
    });

    it("labels ancestors without a known label by their distance", () => {
        const unlabeled: CssElementStyles = toElementStyles(matched, { element: "div.card", ancestors: [] });
        expect(unlabeled.parent?.label).toBe("ancestor 1");
    });
});

describe("selector labels", () => {
    it("keeps only the selectors that match the element", () => {
        const rule: CdpRuleMatch = {
            rule: {
                selectorList: { text: "h1, .card", selectors: [{ text: "h1" }, { text: ".card" }] },
                origin: "regular",
                style: { cssProperties: [{ name: "margin", value: "0", text: "margin: 0;" }] },
            },
            matchingSelectors: [1],
        };
        const styles: CssElementStyles = toElementStyles(
            { matchedCSSRules: [rule] },
            { element: "div.card", ancestors: [] },
        );
        expect(styles.declarations[0].selector).toBe(".card");
    });

    it("falls back to the whole selector list without matching selectors", () => {
        const rule: CdpRuleMatch = {
            rule: {
                selectorList: { text: "h1, .card", selectors: [{ text: "h1" }, { text: ".card" }] },
                origin: "regular",
                style: { cssProperties: [{ name: "margin", value: "0", text: "margin: 0;" }] },
            },
            matchingSelectors: [],
        };
        const styles: CssElementStyles = toElementStyles(
            { matchedCSSRules: [rule] },
            { element: "div.card", ancestors: [] },
        );
        expect(styles.declarations[0].selector).toBe("h1, .card");
    });
});
