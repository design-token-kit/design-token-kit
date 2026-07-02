import { describe, it, expect } from "vitest";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import type { ParsedTokenCss, ScopedTokenEntry } from "#/core/showcase/CssTokenParser";

function entry(name: string, value: string, scope = "primitive", themeName?: string): ScopedTokenEntry {
    return { name, value, scope, themeName };
}

function parsed(entries: ScopedTokenEntry[], themes = []): ParsedTokenCss {
    return { entries, themes };
}

describe("TokenHtmlShowcaseRenderer", () => {
    const renderer = new TokenHtmlShowcaseRenderer();

    describe("renderPage - empty input", () => {
        it("returns valid HTML document for empty input", () => {
            const html = renderer.renderPage(parsed([]));
            expect(html).toContain("<!DOCTYPE html>");
            expect(html).toContain("<html");
            expect(html).toContain("</html>");
        });

        it("shows 'No tokens found' message when there are no tokens", () => {
            const html = renderer.renderPage(parsed([]));
            expect(html).toContain("No tokens found");
        });

        it("does not render sidebar when there are no tokens", () => {
            const html = renderer.renderPage(parsed([]));
            expect(html).not.toContain(`class="sidebar"`);
        });
    });

    describe("renderPage - basic structure", () => {
        it("renders page-shell when tokens are present", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).toContain("page-shell");
        });

        it("renders sidebar and main content areas", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).toContain(`class="sidebar"`);
            expect(html).toContain(`class="content"`);
        });

        it("renders back-to-top button", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).toContain("back-to-top");
        });

        it("inlines navigation JavaScript", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).toContain("<script>");
            expect(html).toContain("scrollToAnchor");
        });

        it("includes embedded CSS styles", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).toContain("<style>");
        });
    });

    describe("renderPage - component scope filtering", () => {
        it("does not render component scope as a top-level section", () => {
            const html = renderer.renderPage(parsed([
                entry("--component-color-card-bg", "var(--x)", "component"),
                entry("--primitive-color-brand", "#fff", "primitive"),
            ]));
            expect(html).not.toContain("id=\"scope-component\"");
        });

        it("renders primitive scope", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff", "primitive"),
            ]));
            expect(html).toContain("id=\"scope-primitive\"");
        });
    });

    describe("renderPage - color tokens", () => {
        it("renders color swatch for hex value", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6"),
            ]));
            expect(html).toContain("token-swatch");
            expect(html).toContain("#2549f6");
        });

        it("renders color type badge", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6"),
            ]));
            expect(html).toContain("token-type-badge");
            expect(html).toContain("colors");
        });

        it("includes token name in output", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6"),
            ]));
            expect(html).toContain("--primitive-color-brand");
        });
    });

    describe("renderPage - typography tokens", () => {
        it("renders font preview element for font-size token", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-font-size-md", "16px"),
            ]));
            expect(html).toContain("font-preview");
        });

        it("renders combined typography card for aggregated typography tokens", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-typography-body-md-fontSize", "16px"),
                entry("--primitive-typography-body-md-fontWeight", "400"),
                entry("--primitive-typography-body-md-lineHeight", "1.5"),
                entry("--primitive-typography-body-md-fontFamily-0", "Inter"),
            ]));
            expect(html).toContain("--primitive-typography-body-md");
            expect(html).toContain("font-preview");
        });
    });

    describe("renderPage - gradient tokens", () => {
        it("renders gradient swatch with stops", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-gradient-brand", "linear-gradient(90deg, #2549f6, #1d39da)"),
                entry("--primitive-gradient-brand-0-color", "#2549f6"),
                entry("--primitive-gradient-brand-0-position", "0"),
                entry("--primitive-gradient-brand-1-color", "#1d39da"),
                entry("--primitive-gradient-brand-1-position", "1"),
            ]));
            expect(html).toContain("gradient-stop");
            expect(html).toContain("#2549f6");
        });
    });

    describe("renderPage - shadow tokens", () => {
        it("renders shadow preview box", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-shadow-md", "0 4px 8px rgba(0,0,0,.2)"),
                entry("--primitive-shadow-md-offsetX", "0px"),
                entry("--primitive-shadow-md-offsetY", "4px"),
                entry("--primitive-shadow-md-blur", "8px"),
                entry("--primitive-shadow-md-spread", "0px"),
                entry("--primitive-shadow-md-color", "rgba(0,0,0,.2)"),
            ]));
            expect(html).toContain("shadow-preview");
            expect(html).toContain("box-shadow");
        });
    });

    describe("renderPage - border tokens", () => {
        it("renders border preview box", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-border-focus-ring", "2px solid #000"),
                entry("--primitive-border-focus-ring-color", "#000"),
                entry("--primitive-border-focus-ring-width", "2px"),
                entry("--primitive-border-focus-ring-style", "solid"),
            ]));
            expect(html).toContain("border-preview");
        });
    });

    describe("renderPage - spacing tokens", () => {
        it("renders dimension marker for spacing tokens", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-space-inset-sm", "8px"),
            ]));
            expect(html).toContain("dimension-marker");
        });
    });

    describe("renderPage - radius tokens", () => {
        it("renders radius preview box", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-dimension-radius-md", "8px"),
            ]));
            expect(html).toContain("radius-preview");
            expect(html).toContain("border-radius");
        });
    });

    describe("renderPage - opacity tokens", () => {
        it("renders opacity preview", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-opacity-disabled", "0.38"),
            ]));
            expect(html).toContain("opacity-preview");
        });

        it("renders percent resolved value for decimal opacity", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-opacity-disabled", "0.5"),
            ]));
            expect(html).toContain("50%");
        });
    });

    describe("renderPage - semantic tokens", () => {
        it("renders semantic roles section", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6", "primitive"),
                entry("--semantic-color-text-primary", "var(--primitive-color-brand)", "semantic"),
            ]));
            expect(html).toContain("Semantic roles");
        });

        it("renders color swatch for resolvable semantic color", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6", "primitive"),
                entry("--semantic-color-text-primary", "var(--primitive-color-brand)", "semantic"),
            ]));
            expect(html).toContain("semantic-role__swatch");
        });

        it("renders resolved value for semantic token", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#2549f6", "primitive"),
                entry("--semantic-color-text-primary", "var(--primitive-color-brand)", "semantic"),
            ]));
            expect(html).toContain("#2549f6");
        });

        it("renders warning for unresolved reference", () => {
            const html = renderer.renderPage(parsed([
                entry("--semantic-color-status-danger", "var(--primitive-color-missing)", "semantic"),
            ]));
            expect(html).toContain("warning: unresolved reference");
        });

        it("renders warning when semantic token references component token", () => {
            const html = renderer.renderPage(parsed([
                entry("--component-color-card-bg", "#fff", "component"),
                entry("--semantic-color-background-surface", "var(--component-color-card-bg)", "semantic"),
            ]));
            expect(html).toContain("warning: references component token");
        });
    });

    describe("renderPage - themes", () => {
        it("renders theme statistics section when themes are present", () => {
            const html = renderer.renderPage({
                entries: [
                    entry("--primitive-color-brand-500", "#2549f6", "primitive", "base"),
                    entry("--primitive-color-brand-500", "#4865f5", "primitive", "base.dark"),
                ],
                themes: [
                    {
                        name: "base",
                        entries: [entry("--primitive-color-brand-500", "#2549f6", "primitive", "base")],
                    },
                    {
                        name: "base.dark",
                        entries: [entry("--primitive-color-brand-500", "#4865f5", "primitive", "base.dark")],
                    },
                ],
            });
            expect(html).toContain("Theme statistics");
            expect(html).toContain("base");
            expect(html).toContain("base.dark");
        });

        it("shows override count in theme summary", () => {
            const html = renderer.renderPage({
                entries: [
                    entry("--primitive-color-brand-500", "#2549f6", "primitive", "base"),
                    entry("--primitive-color-brand-500", "#4865f5", "primitive", "base.dark"),
                ],
                themes: [
                    {
                        name: "base",
                        entries: [entry("--primitive-color-brand-500", "#2549f6", "primitive", "base")],
                    },
                    {
                        name: "base.dark",
                        entries: [entry("--primitive-color-brand-500", "#4865f5", "primitive", "base.dark")],
                    },
                ],
            });
            expect(html).toContain("Overrides");
        });

        it("does not render theme statistics when no themes", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff"),
            ]));
            expect(html).not.toContain("Theme statistics");
        });

        it("filters out component entries from visible themes", () => {
            const html = renderer.renderPage({
                entries: [
                    entry("--primitive-color-brand", "#fff", "primitive", "base"),
                    entry("--component-bg", "#000", "component", "base"),
                ],
                themes: [
                    {
                        name: "base",
                        entries: [
                            entry("--primitive-color-brand", "#fff", "primitive", "base"),
                            entry("--component-bg", "#000", "component", "base"),
                        ],
                    },
                ],
            });
            expect(html).not.toContain("component-bg");
        });
    });

    describe("renderPage - HTML escaping", () => {
        it("escapes HTML special characters in token names", () => {
            const html = renderer.renderPage(parsed([
                entry('--primitive-color-"brand"', "#fff"),
            ]));
            expect(html).not.toContain('"brand"');
            expect(html).toContain("&quot;brand&quot;");
        });

        it("escapes HTML special characters in token names", () => {
            const html = renderer.renderPage(parsed([
                entry('--primitive-color-<xss>', "#fff"),
            ]));
            expect(html).not.toContain("<xss>");
            expect(html).toContain("&lt;xss&gt;");
        });
    });

    describe("renderPage - sidebar navigation", () => {
        it("renders sidebar toggle buttons for each visible scope", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff", "primitive"),
                entry("--semantic-color-text-primary", "var(--x)", "semantic"),
            ]));
            expect(html).toContain("data-menu-toggle");
            expect(html).toContain("sidebar-toggle");
        });

        it("renders sub-links for token groups in sidebar", () => {
            const html = renderer.renderPage(parsed([
                entry("--primitive-color-brand", "#fff", "primitive"),
            ]));
            expect(html).toContain("sidebar-sub-link");
        });
    });
});
