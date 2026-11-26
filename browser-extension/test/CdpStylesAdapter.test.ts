import { describe, expect, it } from "vitest";
import { CdpStylesAdapter } from "#/CdpStylesAdapter";

describe("CdpStylesAdapter", () => {
    const adapter = new CdpStylesAdapter();

    it("keeps inline declarations before matched rules", () => {
        const styles = adapter.toElementStyles("div.card", {
            inlineStyle: {
                cssProperties: [{
                    name: "color",
                    value: "var(--inline-color)",
                    important: true,
                }],
            },
            matchedCSSRules: [{
                rule: {
                    selectorList: { text: ".card" },
                    style: {
                        cssProperties: [{
                            name: "color",
                            value: "var(--card-color)",
                        }],
                    },
                },
            }],
        });

        expect(styles).toEqual({
            label: "div.card",
            declarations: [
                {
                    property: "color",
                    value: "var(--inline-color)",
                    important: true,
                    selector: "element.style",
                },
                {
                    property: "color",
                    value: "var(--card-color)",
                    important: false,
                    selector: ".card",
                },
            ],
            parent: undefined,
        });
    });

    it("maps inherited style entries to the element parent chain", () => {
        const styles = adapter.toElementStyles(
            "span",
            {
                inherited: [
                    {
                        matchedCSSRules: [{
                            rule: {
                                selectorList: { text: "body" },
                                style: {
                                    cssProperties: [{
                                        name: "color",
                                        value: "var(--body-color)",
                                    }],
                                },
                            },
                        }],
                    },
                    {
                        matchedCSSRules: [{
                            rule: {
                                selectorList: { text: ":root" },
                                style: {
                                    cssProperties: [{
                                        name: "--body-color",
                                        value: "#111111",
                                    }],
                                },
                            },
                        }],
                    },
                ],
            },
            ["body", "html"],
        );

        expect(styles.parent).toMatchObject({
            label: "body",
            declarations: [expect.objectContaining({ selector: "body" })],
            parent: {
                label: "html",
                declarations: [expect.objectContaining({ selector: ":root" })],
            },
        });
    });

    it("removes disabled and incomplete declarations", () => {
        const styles = adapter.toElementStyles("div", {
            inlineStyle: {
                cssProperties: [
                    { name: "color", value: "#111111", disabled: true },
                    { name: "padding", value: "8px" },
                    { name: "margin" },
                ],
            },
        });

        expect(styles.declarations).toEqual([{
            property: "padding",
            value: "8px",
            important: false,
            selector: "element.style",
        }]);
    });

    it("orders rules and declarations by the cascade", () => {
        const styles = adapter.toElementStyles("div.card", {
            matchedCSSRules: [{
                rule: {
                    selectorList: { text: ".card" },
                    style: {
                        cssProperties: [{
                            name: "color",
                            value: "var(--base-color)",
                        }],
                    },
                },
            }, {
                rule: {
                    selectorList: { text: ".card.active" },
                    style: {
                        cssProperties: [
                            { name: "color", value: "var(--active-color)" },
                            { name: "color", value: "var(--important-color)", important: true },
                        ],
                    },
                },
            }],
        });

        expect(styles.declarations.map((declaration) => declaration.value)).toEqual([
            "var(--important-color)",
            "var(--active-color)",
            "var(--base-color)",
        ]);
    });

    it("places an important declaration before later ordinary declarations", () => {
        const styles = adapter.toElementStyles("div.card", {
            matchedCSSRules: [{
                rule: {
                    selectorList: { text: ".card" },
                    style: {
                        cssProperties: [{
                            name: "color",
                            value: "var(--base-color)",
                            important: true,
                        }],
                    },
                },
            }, {
                rule: {
                    selectorList: { text: ".card.active" },
                    style: {
                        cssProperties: [{
                            name: "color",
                            value: "var(--active-color)",
                        }],
                    },
                },
            }],
        });

        expect(styles.declarations[0].value).toBe("var(--base-color)");
    });
});
