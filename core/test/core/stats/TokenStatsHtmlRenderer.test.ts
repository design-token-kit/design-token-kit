import { describe, expect, it } from "vitest";
import { TokenStatsHtmlRenderer } from "#/core/stats/TokenStatsHtmlRenderer";
import { TOKEN_STATS_CSS } from "#/core/stats/TokenStatsStyles";
import type { TokenStat } from "#/core/stats/TokenStatsCalculator";

describe("TokenStatsHtmlRenderer", () => {
    const renderer = new TokenStatsHtmlRenderer();

    it("renders a full html document with embedded stats styles", () => {
        const html = renderer.render([]);
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("<title>Design Tokens - Statistics</title>");
        expect(html).toContain(TOKEN_STATS_CSS.trim().slice(0, 40));
        expect(html).toContain("stats-summary");
    });

    it("renders summary cards, grouped breakdowns, themes panel, and fallback sections", () => {
        const stats: TokenStat[] = [
            {
                label: "Total tokens",
                value: 10,
                description: "Summary <desc>",
                breakdowns: [
                    {
                        label: "Tokens by namespace",
                        items: [
                            { label: "primitive", value: 5, percentage: 50 },
                            { label: "semantic", value: 5, percentage: 50 },
                        ],
                    },
                    {
                        label: "Primitive tokens by type",
                        items: [
                            { label: "color", value: 2, percentage: 20 },
                            { label: "gradient", value: 1, percentage: 10 },
                        ],
                    },
                    {
                        label: "Themes 3",
                        items: [
                            { label: "base" },
                            { label: "dark" },
                            { label: "red" },
                        ],
                    },
                    {
                        label: "Tokens by theme",
                        items: [
                            { label: "dark", value: 4, percentage: 40 },
                            { label: "red", value: 3, percentage: 30 },
                        ],
                    },
                    {
                        label: "Custom <Breakdown>",
                        items: [
                            { label: "logo", value: 1 },
                        ],
                    },
                ],
            },
            {
                label: "Referenced tokens",
                value: 6,
                percentage: 60,
            },
            {
                label: "Direct values",
                value: 4,
                percentage: 40,
            },
        ];

        const html = renderer.render(stats);

        expect(html).toContain("stats-card--total-tokens");
        expect(html).toContain("Summary &lt;desc&gt;");
        expect(html).toContain("6 - 60.0%");
        expect(html).toContain("stats-dashboard__stack");
        expect(html).toContain("stats-dashboard__side");
        expect(html).toContain("Themes 3");
        expect(html).toContain("Theme overrides");
        expect(html).toContain("theme-chip--base");
        expect(html).toContain("theme-chip--dark");
        expect(html).toContain("theme-chip--red");
        expect(html).toContain("stats-fallback");
        expect(html).toContain("Custom &lt;Breakdown&gt;");
        expect(html).toContain("metric-card--logo");
    });

    it("renders chip-only breakdowns and default icon fallback", () => {
        const html = renderer.render([
            {
                label: "Unknown metric",
                value: 1,
                breakdowns: [
                    {
                        label: "Ad hoc list",
                        items: [
                            { label: "custom-theme" },
                        ],
                    },
                ],
            },
        ]);

        expect(html).toContain("stats-breakdown__items--chips");
        expect(html).toContain("theme-chip--custom-theme");
        expect(html).toContain("stats-icon");
    });
});
