import { TOKEN_HTML_SHOWCASE_CSS } from "#/core/showcase/TokenHtmlShowcaseStyles";
import type { TokenStat } from "#/core/stats/TokenStatsCalculator";
import { TOKEN_STATS_CSS } from "#/core/stats/TokenStatsStyles";

/**
 * Renders token statistics as a standalone HTML page.
 *
 * @remarks
 * Produces a full HTML document with metrics cards and optional
 * per-theme breakdown sections.
 */
export class TokenStatsHtmlRenderer {
    /**
     * Renders statistics to an HTML string.
     *
     * @param stats - Array of statistic entries to render.
     * @returns Complete HTML document as a string.
     */
    render(stats: readonly TokenStat[]): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Design Tokens - stats</title>
<style>
${TOKEN_HTML_SHOWCASE_CSS}
${TOKEN_STATS_CSS}
</style>
</head>
<body>
<header class="page-header"><h1 class="page-title">Design Tokens - stats</h1></header>
<main class="content">
<section class="stats-shell">
<div class="stats-grid">
${stats.map((stat) => this.#renderStat(stat)).join("\n")}
</div>
${stats.flatMap((stat) => this.#renderBreakdowns(stat)).join("\n")}
</section>
</main>
</body>
</html>`;
    }

    /** Renders a single statistic as an HTML card. */
    #renderStat(stat: TokenStat): string {
        return `<article class="stats-card"><div class="stats-card__eyebrow">Metric</div><div class="stats-card__value">${this.#formatStatValue(stat)}</div><div class="stats-card__name">${this.#esc(stat.label)}</div>${stat.description ? `<p class="stats-card__description">${this.#esc(stat.description)}</p>` : ""}</article>`;
    }

    #renderBreakdowns(stat: TokenStat): string[] {
        return (stat.breakdowns ?? [])
            .filter((breakdown) => breakdown.items.length > 0)
            .map((breakdown) => {
                const cards = breakdown.items
                    .map((item) => {
                        const value = this.#formatBreakdownValue(item);
                        return `<article class="theme-summary-card"><div class="theme-summary-header"><span class="theme-summary-label">Name:</span><span class="theme-summary-name">${this.#esc(item.label)}</span></div>${value === undefined ? "" : `<dl class="theme-summary-stats"><div><dt>${this.#esc(stat.label)}</dt><dd>${value}</dd></div></dl>`}</article>`;
                    })
                    .join("\n");

                return `<section class="stats-breakdown"><div class="stats-breakdown__title">${this.#esc(breakdown.label)}</div><div class="theme-summary-grid">${cards}</div></section>`;
            });
    }

    #formatBreakdownValue(item: { value?: number; percentage?: number }): string | undefined {
        if (item.value === undefined) {
            return undefined;
        }

        if (item.percentage === undefined) {
            return String(item.value);
        }

        return `${item.value} - ${item.percentage.toFixed(1)}%`;
    }

    #formatStatValue(stat: { value: number; percentage?: number }): string {
        if (stat.percentage === undefined) {
            return String(stat.value);
        }

        return `${stat.value} - ${stat.percentage.toFixed(1)}%`;
    }

    /** HTML-escapes a string for safe interpolation. */
    #esc(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
