import { TOKEN_HTML_SHOWCASE_CSS } from "#/core/showcase/TokenHtmlShowcaseStyles";
import type { TokenStat, TokenStatBreakdown } from "#/core/stats/TokenStatsCalculator";
import { TOKEN_STATS_CSS } from "#/core/stats/TokenStatsStyles";

/**
 * Renders token statistics as a standalone HTML page.
 *
 * @remarks
 * Produces a full static HTML document with dashboard cards and optional
 * breakdown sections.
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
<title>Design Tokens - Statistics</title>
<style>
${TOKEN_HTML_SHOWCASE_CSS}
${TOKEN_STATS_CSS}
</style>
</head>
<body>
${this.#renderHeader()}
<main class="content stats-content">
<section class="stats-shell">
${this.#renderSummary(stats)}
${this.#renderBreakdownLayout(stats)}
</section>
</main>
</body>
</html>`;
    }

    #renderHeader(): string {
        return `<header class="page-header stats-header"><div class="stats-brand"><h1 class="page-title stats-title">Design Tokens - Statistics</h1></div></header>`;
    }

    #renderSummary(stats: readonly TokenStat[]): string {
        return `<section class="stats-summary" aria-label="Summary">
${stats.map((stat) => this.#renderStatCard(stat)).join("\n")}
</section>`;
    }

    #renderStatCard(stat: TokenStat): string {
        const slug = this.#slug(stat.label);
        return `<article class="stats-card stats-card--${slug}">
<div class="stats-card__head">
<span class="stats-icon-badge stats-icon-badge--${slug}">${this.#icon(stat.label)}</span>
<div class="stats-card__name">${this.#esc(stat.label)}</div>
</div>
<div class="stats-card__value">${this.#formatStatValue(stat)}</div>
${stat.description ? `<p class="stats-card__description">${this.#esc(stat.description)}</p>` : ""}
</article>`;
    }

    #renderBreakdownLayout(stats: readonly TokenStat[]): string {
        const sections = stats
            .flatMap((stat) => stat.breakdowns ?? [])
            .filter((breakdown) => breakdown.items.length > 0);

        const namespace = sections.filter((breakdown) => breakdown.label === "Tokens by namespace");
        const typeBreakdowns = sections.filter((breakdown) => breakdown.label === "Primitive tokens by type" || breakdown.label === "Tokens by type");
        const themes = sections.find((breakdown) => breakdown.label.startsWith("Themes"));
        const tokensByTheme = sections.find((breakdown) => breakdown.label === "Tokens by theme");
        const known = new Set([
            ...namespace,
            ...typeBreakdowns,
            ...(themes ? [themes] : []),
            ...(tokensByTheme ? [tokensByTheme] : []),
        ]);
        const fallback = sections.filter((breakdown) => !known.has(breakdown));

        const namespaceSection = namespace
            .map((breakdown) => this.#renderBreakdownSection(breakdown))
            .join("\n");
        const primitiveSection = typeBreakdowns
            .map((breakdown) => this.#renderBreakdownSection(breakdown))
            .join("\n");
        const themesSection = themes ? this.#renderThemesPanel(themes, tokensByTheme) : "";

        return `<section class="stats-dashboard" aria-label="Breakdowns">
${namespaceSection ? `<div class="stats-dashboard__stack">${namespaceSection}</div>` : ""}
${primitiveSection || themesSection ? `<div class="stats-dashboard__row"><div class="stats-dashboard__main">${primitiveSection}</div>${themesSection ? `<section class="stats-dashboard__side">${themesSection}</section>` : ""}</div>` : ""}
</section>
${fallback.length > 0 ? `<section class="stats-fallback">${fallback.map((breakdown) => this.#renderBreakdownSection(breakdown)).join("\n")}</section>` : ""}`;
    }

    #renderThemesPanel(themes: TokenStatBreakdown, overrides?: TokenStatBreakdown): string {
        const chips = themes.items.map((item) => this.#renderThemeChip(item.label)).join("\n");
        const overrideItems = overrides?.items.length
            ? overrides.items.map((item) => this.#renderThemeOverrideItem(item.label, item)).join("\n")
            : "";

        return `<section class="themes-panel">
<div class="themes-panel__header">
<h2 class="stats-breakdown__title">${this.#esc(themes.label)}</h2>
</div>
<div class="theme-chip-list">${chips}</div>
${overrideItems ? `<div class="theme-overrides"><div class="theme-overrides__title">Theme overrides</div><div class="theme-overrides__list">${overrideItems}</div></div>` : ""}
</section>`;
    }

    #renderBreakdownSection(breakdown: TokenStatBreakdown): string {
        const slug = this.#slug(breakdown.label);
        const hasOnlyChips = breakdown.items.every((item) => item.value === undefined);
        const items = breakdown.items
            .map((item) => hasOnlyChips ? this.#renderThemeChip(item.label) : this.#renderBreakdownItem(item.label, item))
            .join("\n");

        return `<section class="stats-breakdown stats-breakdown--${slug}">
<h2 class="stats-breakdown__title">${this.#esc(breakdown.label)}</h2>
<div class="stats-breakdown__items ${hasOnlyChips ? "stats-breakdown__items--chips" : ""}">${items}</div>
</section>`;
    }

    #renderBreakdownItem(label: string, item: { value?: number; percentage?: number }): string {
        const value = this.#formatBreakdownValue(item);
        const slug = this.#slug(label);

        return `<article class="metric-card metric-card--${slug}">
<span class="metric-card__icon stats-icon-badge stats-icon-badge--${slug}">${this.#icon(label)}</span>
<div class="metric-card__body">
<div class="metric-card__name">${this.#esc(label)}</div>
${value === undefined ? "" : `<div class="metric-card__value">${value}</div>`}
</div>
</article>`;
    }

    #renderThemeChip(label: string): string {
        const slug = this.#slug(label);
        return `<span class="theme-chip theme-chip--${slug}">
<span class="theme-chip__icon">${this.#icon(label)}</span>
<span class="theme-chip__label">${this.#esc(label)}</span>
</span>`;
    }

    #renderThemeOverrideItem(label: string, item: { value?: number; percentage?: number }): string {
        const value = this.#formatBreakdownValue(item);
        return `<article class="theme-override-item">
<div class="theme-override-item__name"><span class="theme-dot theme-dot--${this.#slug(label)}"></span><span>${this.#esc(label)}</span></div>
<div class="theme-override-item__value">${value === undefined ? "" : value}</div>
</article>`;
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

    #icon(label: string): string {
        switch (this.#slug(label)) {
            case "logo":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "total-tokens":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 4 8l8 4 8-4-8-4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m4 12 8 4 8-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m4 16 8 4 8-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            case "referenced-tokens":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 10.5 7 12a4 4 0 0 0 5.7 5.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m9.9 7.7 1.4-1.4A4 4 0 1 1 17 12l-1.5 1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
            case "direct-values":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5c-2 0-3 1-3 3v2c0 1-.7 2-2 2 1.3 0 2 1 2 2v2c0 2 1 3 3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 5c2 0 3 1 3 3v2c0 1 .7 2 2 2-1.3 0-2 1-2 2v2c0 2-1 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
            case "primitive":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m5 7 7 4 7-4M12 21V11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
            case "semantic":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v6.5L12.5 20 20 12.5 11.5 4H5a1 1 0 0 0-1 1Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/></svg>`;
            case "component":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="4" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="14" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="6" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "color":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
            case "dimension":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 17 12-12 2 2L7 19l-2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m9 15-2-2m5-1-2-2m5-1-2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
            case "font-family":
                return `<svg class="stats-icon stats-icon--text" viewBox="0 0 24 24" aria-hidden="true"><text x="4" y="16" fill="currentColor" font-size="11" font-weight="700" font-family="Arial, sans-serif">Aa</text></svg>`;
            case "font-weight":
                return `<svg class="stats-icon stats-icon--text" viewBox="0 0 24 24" aria-hidden="true"><text x="7" y="17" fill="currentColor" font-size="15" font-weight="800" font-family="Arial, sans-serif">T</text></svg>`;
            case "duration":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
            case "cubic-bezier":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18C5 9 10 15 10 8c0-2 1.5-3 4-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="5" cy="18" r="1.5" fill="currentColor"/><circle cx="14" cy="5" r="1.5" fill="currentColor"/></svg>`;
            case "number":
                return `<svg class="stats-icon stats-icon--text" viewBox="0 0 24 24" aria-hidden="true"><text x="3" y="16" fill="currentColor" font-size="10" font-weight="800" font-family="Arial, sans-serif">123</text></svg>`;
            case "stroke-style":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4m4 0h4m4 0h0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
            case "border":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
            case "transition":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l10-7L8 5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
            case "shadow":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
            case "gradient":
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V5h14L5 19Z" fill="currentColor" opacity=".28"/><path d="M5 19V5h14v14H5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
            case "typography":
                return `<svg class="stats-icon stats-icon--text" viewBox="0 0 24 24" aria-hidden="true"><text x="6" y="17" fill="currentColor" font-size="16" font-weight="700" font-family="Georgia, serif">¶</text></svg>`;
            case "base":
            case "dark":
            case "red":
                return `<svg class="stats-icon stats-icon--dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor"/></svg>`;
            default:
                return `<svg class="stats-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
        }
    }

    #slug(str: string): string {
        return str
            .trim()
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "item";
    }

    #esc(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
