export const TOKEN_STATS_CSS = `
.stats-shell {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 0.75rem;
}

.stats-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.stats-card__value {
    color: #0f172a;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
}

.stats-card__name {
    color: #334155;
    font-size: 1rem;
    font-weight: 700;
}

.stats-card__description {
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.5;
}

.stats-breakdown {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.stats-breakdown__title {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
}
`;
