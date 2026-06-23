export const TOKEN_HTML_SHOWCASE_CSS = `
*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    scroll-padding-top: 112px;
}

[id] {
    scroll-margin-top: 112px;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f8fafc;
    color: #1e293b;
}

.page-header {
    position: sticky;
    top: 0;
    z-index: 20;
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    background: #fff;
}

.page-title {
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
}

.page-shell {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: calc(100vh - 64px);
}

.sidebar {
    border-right: 1px solid #e2e8f0;
    background: #fff;
    padding: 0.875rem 0.625rem;
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
    overflow: auto;
}

.sidebar-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin: 0 0.625rem 0.75rem;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.sidebar-group {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.sidebar-group-body {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding-left: 0.75rem;
}

.sidebar-group-body--scope {
    padding-left: 1rem;
}

.sidebar-group-body[hidden] {
    display: none;
}

.sidebar-link {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-height: 28px;
    padding: 0.25rem 0.375rem;
    border-radius: 4px;
    text-decoration: none;
    color: #334155;
    font-size: 0.8125rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 600;
    background: transparent;
    border: 0;
    text-align: left;
    cursor: pointer;
}

.sidebar-link:hover {
    background: #f1f5f9;
}

.sidebar-toggle[aria-expanded="true"] {
    background: #e2e8f0;
}

.sidebar-chevron {
    width: 0.3125rem;
    height: 0.3125rem;
    border-right: 1.25px solid #94a3b8;
    border-bottom: 1.25px solid #94a3b8;
    transform: rotate(-45deg);
    transition: transform 0.12s ease;
    flex-shrink: 0;
}

.sidebar-toggle[aria-expanded="true"] .sidebar-chevron {
    transform: rotate(45deg);
}

.lucide-folder {
    width: 1rem;
    height: 1rem;
    color: #64748b;
    flex-shrink: 0;
}

.sidebar-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sidebar-sub-link {
    display: block;
    padding: 0.25rem 0.375rem 0.25rem 1rem;
    border-radius: 4px;
    text-decoration: none;
    color: #64748b;
    font-size: 0.75rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.35;
}

.sidebar-sub-link:hover {
    background: #f1f5f9;
    color: #334155;
}

.sidebar-sub-label {
    display: block;
    padding: 0.375rem 0.625rem 0.125rem;
    color: #334155;
    font-size: 0.75rem;
    font-weight: 700;
    font-family: "JetBrains Mono", monospace;
}

.sidebar-sub-link--nested {
    padding-left: 2rem;
}

.sidebar-sub-label--nested {
    padding-left: 2rem;
}

.sidebar-sub-link--deep {
    padding-left: 2.75rem;
}

.content {
    padding: 1.5rem 1.5rem 2rem;
}

.theme-summary {
    margin-bottom: 1.5rem;
}

.theme-summary-title {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
}

.theme-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.5rem;
}

.theme-summary-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #fff;
    padding: 0.625rem;
}

.theme-summary-header {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
}

.theme-summary-label {
    color: #64748b;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.theme-summary-name {
    color: #0f172a;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.875rem;
}

.theme-summary-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.375rem;
    margin: 0.5rem 0 0;
}

.theme-summary-stats div {
    border-radius: 8px;
    background: #f8fafc;
    padding: 0.375rem;
}

.theme-summary-stats dt {
    color: #64748b;
    font-size: 0.6875rem;
    text-transform: uppercase;
}

.theme-summary-stats dd {
    margin: 0.25rem 0 0;
    color: #0f172a;
    font-size: 0.9375rem;
}

.back-to-top {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 40;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    color: #334155;
    background: #fff;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
}

.back-to-top:hover {
    background: #f8fafc;
}

.token-category {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    text-transform: capitalize;
}

.token-section {
    margin-bottom: 2rem;
}

.token-section--theme-scope {
    margin-bottom: 1.5rem;
}

.theme-section {
    margin-bottom: 2rem;
}

.theme-title {
    font-size: 1.4rem;
    font-weight: 400;
    color: #334155;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
}

.token-subgroup-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin: 0 0 0.625rem;
}

.token-subgroup {
    margin-bottom: 1.5rem;
}

.token-list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.75rem;
}

.token-list.token-list--font {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.token-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    min-height: 130px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.75rem 0.875rem;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.8125rem;
}

.token-swatch {
    width: 100%;
    height: 56px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    flex-shrink: 0;
}

.token-item--color-card {
    position: relative;
    gap: 0;
    min-height: 205px;
    padding: 0.5rem;
    border-radius: 6px;
    overflow: hidden;
}

.token-item--color-card .token-swatch {
    height: 109px;
    margin-bottom: 0.875rem;
    border: 0;
    border-radius: 4px;
}

.token-item--color-card .token-type-badge {
    position: absolute;
    top: 1.375rem;
    left: 1.4375rem;
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: 3px;
    background: #ffffff;
    color: #8b5cf6;
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1;
}

.token-item--color-card .token-name {
    width: 100%;
    margin: 0 0 auto;
    padding: 0 0.875rem 0 0;
    color: #334155;
    font-size: 0.875rem;
    line-height: 1.45;
    min-height: 0;
    word-break: normal;
    overflow-wrap: anywhere;
}

.token-item--color-card .token-meta {
    padding: 0 0.875rem 0.375rem 0;
}

.token-item--color-card .token-meta b {
    color: #334155;
}

.token-name {
    color: #475569;
    min-width: 0;
    word-break: break-all;
    font-size: 14px;
    margin-bottom: 0.25rem;
    min-height: 34px;
}

.font-preview {
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.7rem;
    background: #f8fafc;
    height: 340px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.font-preview--grid {
    background-color: #fcfcfd;
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.font-preview--font-size {
    height: 340px;
}

.font-preview--font-size.font-preview--xl {
    -webkit-line-clamp: 3;
    line-clamp: 3;
}

.font-preview--font-size.font-preview--2xl {
    -webkit-line-clamp: 3;
    line-clamp: 3;
}

.font-preview--font-size.font-preview--3xl {
    -webkit-line-clamp: 2;
    line-clamp: 2;
}

.font-preview--font-size.font-preview--4xl {
    -webkit-line-clamp: 2;
    line-clamp: 2;
}

.token-item--font-card {
    min-height: 0;
}

.token-name--font-card {
    min-height: 0;
}

.token-meta {
    display: block;
    width: 100%;
    color: #64748b;
    font-size: 0.6875rem;
    line-height: 1.35;
}

.token-meta span {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.25rem;
    min-width: 0;
}

.token-meta b {
    color: #334155;
    font-weight: 700;
    margin-right: 0;
    flex-shrink: 0;
}

.token-meta-value {
    color: #64748b;
    background: transparent;
    border-radius: 0;
    padding: 0;
    display: inline-block;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.spacing-visual {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.spacing-bar {
    height: 1rem;
    background: #3b82f6;
    border-radius: 4px;
    flex-shrink: 0;
}

.radius-visual {
    width: 3rem;
    height: 3rem;
    background: #e2e8f0;
    border: 1px dashed #94a3b8;
    flex-shrink: 0;
}

.token-item--radius-card {
    min-height: 0;
}

.radius-preview {
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1.75rem;
    background: #fcfcfd;
}

.radius-preview--grid {
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.radius-preview-box {
    width: 100%;
    height: 100%;
    border: 2px solid #334155;
    background: rgba(255, 255, 255, 0.7);
}

.token-item--opacity-card {
    min-height: 0;
}

.opacity-preview {
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1.75rem;
    background-color: #fcfcfd;
    overflow: hidden;
}

.opacity-preview--checker {
    background-image:
        linear-gradient(45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%);
    background-position:
        0 0,
        0 6px,
        6px -6px,
        -6px 0;
    background-size: 12px 12px;
}

.opacity-preview-fill {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background: #334155;
}

.font-sample {
    font-size: 1.125rem;
}

.shadow-visual {
    width: 4rem;
    height: 4rem;
    background: #fff;
    border-radius: 4px;
    flex-shrink: 0;
}

.token-item--shadow-card {
    min-height: 0;
}

.shadow-preview {
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1.75rem;
    background: #fcfcfd;
    overflow: visible;
}

.shadow-preview--grid {
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.shadow-preview-box {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.92);
}

.shadow-layer {
    display: block;
    color: #64748b;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    line-height: 1.5;
}

.token-item--motion-card {
    min-height: 0;
}

.motion-preview {
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1.75rem;
    background: #fcfcfd;
    overflow: hidden;
}

.motion-preview--grid {
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.motion-track {
    position: relative;
    width: 100%;
    height: 100%;
    border-bottom: 2px solid rgba(51, 65, 85, 0.2);
}

.motion-dot {
    position: absolute;
    left: 0;
    bottom: -7px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: #334155;
    box-shadow: 0 0 0 4px rgba(44, 77, 243, 0.18);
    animation: token-motion-move var(--motion-duration, 1200ms) var(--motion-timing, ease) var(--motion-delay, 0ms) infinite alternate;
}

@keyframes token-motion-move {
    from {
        left: 0;
    }

    to {
        left: calc(100% - 14px);
    }
}

.border-visual {
    width: 4rem;
    height: 2.5rem;
    flex-shrink: 0;
}

.token-item--border-card {
    min-height: 0;
}

.border-preview {
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 1.75rem;
    background: #fcfcfd;
}

.border-preview--grid {
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.border-preview-box {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.7);
}

.token-item--dimension-card {
    min-height: 0;
}

.dimension-preview {
    position: relative;
    width: 100%;
    height: 112px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fcfcfd;
    overflow: hidden;
}

.dimension-preview--grid {
    background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
    background-size: 12px 12px;
}

.dimension-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    min-width: 1px;
    max-width: 100%;
    background: #334155;
    transform: translateX(-50%);
}

.token-meta--stack {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.gradient-visual {
    width: 6rem;
    height: 2.5rem;
    border-radius: 4px;
    flex-shrink: 0;
}

.token-item--gradient-card {
    min-height: 0;
}

.token-item--gradient-card .token-swatch {
    height: 109px;
}

.gradient-stops {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.375rem;
    width: 100%;
}

.gradient-stop {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 0.5rem;
    align-items: center;
    min-width: 0;
}

.gradient-stop__swatch.token-swatch {
    width: 48px;
    height: 28px;
    border-radius: 4px;
}

.gradient-stop__value {
    min-width: 0;
    color: #64748b;
    font-size: 0.6875rem;
    overflow-wrap: anywhere;
}

.token-type-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 0.125rem 0.375rem;
}

.semantic-section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.section-header {
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
}

.section-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.375rem;
}

.section-header p {
    max-width: 680px;
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.5;
}

.semantic-groups {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.semantic-group {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    min-width: 0;
}

.semantic-group h3 {
    grid-column: 1 / -1;
    margin-bottom: 0.5rem;
    color: #64748b;
    font-size: 0.8125rem;
    font-weight: 700;
    text-transform: uppercase;
}

.semantic-role {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 0.75rem;
    align-items: flex-start;
    min-height: 0;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
}

.semantic-role--plain {
    grid-template-columns: 1fr;
}

.semantic-role__content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.375rem;
    align-items: start;
    min-width: 0;
}

.semantic-role__header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
}

.semantic-role__name {
    color: #1e293b;
    font-size: 0.875rem;
    font-weight: 700;
}

.semantic-role__token {
    display: block;
    color: #64748b;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.75rem;
    overflow-wrap: anywhere;
}

.semantic-role__meta {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.375rem;
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.4;
    min-width: 0;
}

.semantic-role__meta span {
    flex-shrink: 0;
    color: #334155;
    font-weight: 700;
}

.semantic-role__meta code {
    color: #64748b;
    font-family: "JetBrains Mono", monospace;
    overflow-wrap: anywhere;
}

.semantic-role__meta--resolved code {
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.semantic-role__parts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    color: #64748b;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.75rem;
    line-height: 1.35;
}

.semantic-role__parts-label {
    color: #334155;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 700;
}

.semantic-role__parts span:not(.semantic-role__parts-label) {
    display: grid;
    grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
    gap: 0.375rem;
    min-width: 0;
}

.semantic-role__parts span:not(.semantic-role__parts-label) code:not(:last-child)::after {
    content: ":";
}

.semantic-role__parts code {
    min-width: 0;
    overflow-wrap: anywhere;
}

.semantic-role__ref {
    color: #2c4df3;
    text-decoration: none;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.semantic-role__ref:hover {
    text-decoration: underline;
}

.semantic-role__warning {
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    padding: 0.125rem 0.375rem;
    border-radius: 999px;
    background: #fff7ed;
    color: #9a3412;
    font-size: 0.6875rem;
    font-weight: 700;
}

.semantic-role__swatch,
.semantic-role__marker,
.semantic-role__space,
.semantic-role__radius,
.semantic-role__text-preview {
    width: 28px;
    height: 28px;
    margin-top: 0.125rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
    flex-shrink: 0;
}

.semantic-role__swatch--empty {
    background:
        linear-gradient(45deg, transparent 45%, #cbd5e1 45%, #cbd5e1 55%, transparent 55%),
        #f8fafc;
}

.semantic-role__marker {
    background: #f8fafc;
}

.semantic-role__space,
.semantic-role__radius {
    position: relative;
    overflow: hidden;
    background:
        linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px),
        #fcfcfd;
    background-size: 7px 7px;
}

.semantic-role__space span {
    position: absolute;
    top: 7px;
    bottom: 7px;
    left: 4px;
    min-width: 1px;
    max-width: 20px;
    background: #334155;
}

.semantic-role__radius span {
    position: absolute;
    inset: 6px;
    border: 2px solid #334155;
    background: rgba(255, 255, 255, 0.7);
}

.semantic-role__text-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #334155;
    font-size: 0.875rem;
    overflow: hidden;
}

@media (max-width: 1480px) {
    .token-list {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}

@media (max-width: 1200px) {
    .token-list {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .token-list.token-list--font {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .semantic-group {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

}

@media (max-width: 1100px) {
    .semantic-group {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 900px) {
    .page-shell {
        grid-template-columns: 1fr;
    }

    .sidebar {
        position: static;
        height: auto;
        border-right: 0;
        border-bottom: 1px solid #e2e8f0;
    }

    .token-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .token-list.token-list--font {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .content {
        padding: 1rem;
    }

    .token-item {
        padding: 0.625rem 0.75rem;
    }

    .token-name {
        min-width: 0;
    }
}

@media (max-width: 560px) {
    .token-list {
        grid-template-columns: 1fr;
    }

    .token-list.token-list--font {
        grid-template-columns: 1fr;
    }

    .semantic-group {
        grid-template-columns: 1fr;
    }

    .semantic-role {
        align-items: flex-start;
    }

    .semantic-role__content {
        grid-template-columns: 1fr;
        gap: 0.25rem;
    }

}

`;
