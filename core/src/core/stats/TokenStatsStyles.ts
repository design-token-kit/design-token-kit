export const TOKEN_STATS_CSS = `
:root {
    --stats-bg: #f8fafc;
    --stats-surface: #ffffff;
    --stats-border: #dbe3ef;
    --stats-border-soft: #e8eef6;
    --stats-text: #0f172a;
    --stats-muted: #64748b;
}

body {
    background: var(--stats-bg);
    color: var(--stats-text);
}

.stats-content {
    width: min(100%, 1500px);
    margin: 0 auto;
    padding: 0 1.5rem 2rem;
}

.stats-shell {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.stats-header {
    width: 100%;
    margin: 0 auto;
    padding: 1.75rem 1.5rem 25px;
    margin-bottom: 1.5rem;
}

.stats-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.875rem;
}

.stats-title {
    margin: 0;
    color: var(--stats-text);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: uppercase;
}

.stats-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
}

.stats-card,
.stats-breakdown,
.metric-card {
    border: 1px solid var(--stats-border);
    background: var(--stats-surface);
}

.stats-card {
    min-height: 10.5rem;
    border-radius: 16px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
}

.stats-card__head {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.stats-card__name {
    color: var(--stats-text);
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.3;
}

.stats-card__value {
    color: var(--stats-text);
    font-size: 1.5rem;
    font-weight: 400;
    line-height: 1;
}

.stats-card__description {
    max-width: 46rem;
    margin: 0;
    color: var(--stats-muted);
    font-size: 0.95rem;
    line-height: 1.55;
}

.stats-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    align-items: start;
}

.stats-dashboard__stack,
.stats-dashboard__row,
.stats-dashboard__main,
.stats-fallback {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.stats-dashboard__stack {
    width: 100%;
    flex: 0 0 100%;
}

.stats-dashboard__row {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
    align-items: flex-start;
}

.stats-dashboard__main {
    min-width: 0;
    grid-column: 1 / span 2;
}

.stats-dashboard__side {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    grid-column: 3;
}

.stats-breakdown {
    border-radius: 16px;
    padding: 1.5rem;
}

.stats-breakdown__title {
    margin: 0 0 1rem;
    color: var(--stats-text);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: 0;
    text-transform: uppercase;
}

.stats-breakdown__items {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.9rem;
}

.stats-breakdown--primitive-tokens-by-type .stats-breakdown__items,
.stats-breakdown--tokens-by-type .stats-breakdown__items {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.stats-breakdown--tokens-by-theme .stats-breakdown__items,
.stats-dashboard__side .stats-breakdown__items {
    grid-template-columns: 1fr;
}

.stats-breakdown__items--chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.metric-card {
    min-height: 5.2rem;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.9rem;
}

.stats-breakdown--tokens-by-theme .metric-card {
    min-height: 6.8rem;
    padding: 1.35rem 1.45rem;
}

.metric-card__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.metric-card__name {
    color: var(--stats-text);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.2;
}

.metric-card__value {
    color: var(--stats-text);
    font-size: 1.2rem;
    font-weight: 400;
    line-height: 1.15;
}

.stats-breakdown--primitive-tokens-by-type .metric-card__value,
.stats-breakdown--tokens-by-type .metric-card__value {
    font-size: 1.02rem;
}

.theme-chip {
    min-height: 36px;
    border: 1px solid var(--stats-border);
    border-radius: 10px;
    background: #fff;
    padding: 0.5rem 0.875rem;
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
}

.theme-chip__icon {
    width: 0.875rem;
    height: 0.875rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    line-height: 0;
    color: #4f83e8;
}

.theme-chip__label {
    color: var(--stats-text);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1;
}

.themes-panel {
    border: 1px solid var(--stats-border);
    border-radius: 16px;
    background: var(--stats-surface);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.themes-panel__header {
    display: flex;
    align-items: center;
}

.themes-panel .stats-breakdown__title {
    margin-bottom: 0;
}

.theme-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.theme-overrides {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
}

.theme-overrides__title {
    color: var(--stats-muted);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.3;
}

.theme-overrides__list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.theme-override-item {
    border: 1px solid var(--stats-border);
    border-radius: 12px;
    background: var(--stats-surface);
    padding: 0.9rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.theme-override-item__name {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--stats-text);
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.2;
}

.theme-override-item__value {
    margin-left: auto;
    color: var(--stats-text);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
}

.theme-dot {
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 50%;
    flex: 0 0 auto;
    background: #4f83e8;
}

.theme-dot--base {
    background: #4f83e8;
}

.theme-dot--dark {
    background: #1f2937;
}

.theme-dot--red {
    background: #e11d48;
}

.stats-icon-badge {
    width: 3rem;
    height: 3rem;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: #2563eb;
    background: #eaf2ff;
}

.stats-card .stats-icon-badge {
    width: 50px;
    height: 50px;
    border-radius: 50%;
}

.stats-icon {
    width: 1.35rem;
    height: 1.35rem;
    display: block;
}

.stats-card .stats-icon {
    width: 1.15rem;
    height: 1.15rem;
}

.stats-icon--logo {
    width: 1.8rem;
    height: 1.8rem;
    color: #4f46e5;
}

.stats-icon--text text {
    dominant-baseline: middle;
}

.stats-icon--dot {
    width: 0.875rem;
    height: 0.875rem;
    display: block;
}

.stats-icon-badge--total-tokens,
.stats-icon-badge--primitive,
.stats-icon-badge--color,
.stats-icon-badge--number,
.stats-icon-badge--transition,
.theme-chip--base .theme-chip__icon {
    color: #2563eb;
    background: #eaf2ff;
}

.stats-icon-badge--referenced-tokens,
.stats-icon-badge--semantic,
.stats-icon-badge--dimension {
    color: #15803d;
    background: #e9f8ea;
}

.stats-icon-badge--direct-values,
.stats-icon-badge--component,
.stats-icon-badge--font-weight,
.stats-icon-badge--shadow {
    color: #7c3aed;
    background: #f0e7ff;
}

.stats-icon-badge--font-family {
    color: #d97706;
    background: #fff3d8;
}

.stats-icon-badge--duration,
.stats-icon-badge--typography {
    color: #ea580c;
    background: #fff0e4;
}

.stats-icon-badge--cubic-bezier {
    color: #db2777;
    background: #fde8f2;
}

.stats-icon-badge--stroke-style,
.stats-icon-badge--gradient {
    color: #0891b2;
    background: #e6f8fb;
}

.stats-icon-badge--border,
.theme-chip--red .theme-chip__icon {
    color: #e11d48;
    background: #fff0f3;
}

.theme-chip--dark .theme-chip__icon,
.metric-card--dark .stats-icon-badge {
    color: #1f2937;
    background: #eef1f5;
}

.metric-card--red .stats-icon-badge {
    color: #e11d48;
    background: #fff0f3;
}

@media (max-width: 1100px) {
    .stats-summary {
        grid-template-columns: 1fr;
    }

    .stats-summary {
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
}

@media (max-width: 760px) {
    .stats-content,
    .stats-header {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .stats-card,
    .stats-breakdown {
        padding: 1.15rem;
    }

    .stats-breakdown__items,
    .stats-breakdown--primitive-tokens-by-type .stats-breakdown__items,
    .stats-breakdown--tokens-by-type .stats-breakdown__items {
        grid-template-columns: 1fr;
    }

    .metric-card {
        min-height: auto;
    }

    .stats-dashboard__row {
        grid-template-columns: 1fr;
    }

    .stats-dashboard__main,
    .stats-dashboard__side {
        grid-column: auto;
    }

    .themes-panel {
        padding: 1rem;
    }

    .stats-dashboard__side {
        width: 100%;
    }

    .theme-override-item {
        align-items: flex-start;
        flex-direction: column;
    }

    .theme-override-item__value {
        margin-left: 0;
        text-align: left;
    }
}
`;
