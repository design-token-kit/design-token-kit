import { TokenPath } from "#/core/model/TokenPath";
import { TOKEN_HTML_SHOWCASE_CSS } from "#/core/showcase/TokenHtmlShowcaseStyles";
import {
    BorderTokenAggregator,
    FontCollectionAggregator,
    GradientTokenAggregator,
    ShadowTokenAggregator,
    TransitionTokenAggregator,
    TypographyTokenAggregator,
} from "#/core/showcase/TokenHtmlShowcaseAggregators";
import {
    ParsedTokenCss,
    ScopedTokenEntry,
    ThemeBucket,
    TokenEntry,
} from "#/core/showcase/CssTokenParser";
import { TokenGroupClassifier } from "#/core/showcase/TokenGroupClassifier";
import {
    BorderTokenInfo,
    BorderWidthTokenInfo,
    GradientTokenInfo,
    ShadowLayerInfo,
    ShadowTokenInfo,
    StrokeStyleTokenInfo,
    TransitionTokenInfo,
    TypographyTokenInfo,
} from "#/core/showcase/TokenHtmlShowcaseAggregators";

type FontVariantCard = {
    name: string;
    value: string;
    previewStyle?: string;
    previewClassName?: string;
    metaLabel: string;
};

type SemanticGroup = {
    key: string;
    title: string;
    tokens: TokenEntry[];
};

type DisplayTokenGroup = {
    key: string;
    title: string;
    group: string;
    tokens: TokenEntry[];
    kind: "tokens" | "fontCollection";
};

type ResolvedTokenValue = {
    value: string;
    unresolvedRefs: string[];
};

/**
 * Renders an HTML page for the token showcase.
 *
 * @remarks
 * Gets prepared token data and builds a complete HTML page:
 * layout, sidebar, sections, cards, preview elements and navigation script.
 */
export class TokenHtmlShowcaseRenderer {
    static readonly #COLOR_HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
    static readonly #FONT_PREVIEW_TEXT = "On sector 42-B, a lone Jedi followed 3 fading signals through the desert night.";
    static readonly #SEMANTIC_GROUP_ORDER = [
        "color.text",
        "color.background",
        "color.border",
        "color.action",
        "color.status",
        "space.inset",
        "space.inline",
        "space.stack",
        "shape.radius",
        "shape.border",
        "text",
        "motion",
        "other",
    ];
    static readonly #SEMANTIC_GROUP_TITLES = new Map<string, string>([
        ["color.text", "Text colors"],
        ["color.background", "Background colors"],
        ["color.border", "Border colors"],
        ["color.action", "Action colors"],
        ["color.status", "Status colors"],
        ["space.inset", "Inset spacing"],
        ["space.inline", "Inline spacing"],
        ["space.stack", "Stack spacing"],
        ["shape.radius", "Radius roles"],
        ["shape.border", "Border roles"],
        ["text", "Text styles"],
        ["motion", "Motion roles"],
        ["other", "Other semantic roles"],
    ]);

    readonly #classifier: TokenGroupClassifier;
    readonly #typographyAggregator = new TypographyTokenAggregator();
    readonly #fontAggregator = new FontCollectionAggregator();
    readonly #borderAggregator = new BorderTokenAggregator();
    readonly #shadowAggregator = new ShadowTokenAggregator();
    readonly #gradientAggregator = new GradientTokenAggregator();
    readonly #transitionAggregator = new TransitionTokenAggregator();

    constructor(classifier = new TokenGroupClassifier()) {
        this.#classifier = classifier;
    }

    renderPage(parsed: ParsedTokenCss): string {
        const scopes = this.#classifier.groupEntriesByScope(parsed.entries);
        const visibleScopes = this.getVisibleScopes(scopes);
        const visibleThemes = this.getVisibleThemes(parsed.themes);
        if (visibleScopes.size === 0) {
            return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Design Tokens - showcase</title>
<style>
${TOKEN_HTML_SHOWCASE_CSS}
body{padding:2rem}
</style>
</head>
<body>
        <h1>Design Tokens - showcase</h1>
<p style="color:#64748b">No tokens found in the CSS output.</p>
</body>
</html>`;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Design Tokens - showcase</title>
<style>
${TOKEN_HTML_SHOWCASE_CSS}
</style>
</head>
<body>
            <header class="page-header"><h1 class="page-title">Design Tokens - showcase</h1></header>
<div class="page-shell">
<aside class="sidebar">
<div class="sidebar-title">Token Groups</div>
<nav class="sidebar-nav">
${this.renderMenu(visibleScopes, visibleThemes)}
</nav>
</aside>
<main class="content">
${this.renderThemeSummary(visibleThemes)}
${this.renderTokens(visibleScopes, visibleThemes, parsed.entries)}
</main>
</div>
<button class="back-to-top" type="button" aria-label="Back to top" title="Back to top">
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"></path></svg>
</button>
<script>
(() => {
  const OFFSET = 112;
  function scrollToAnchor(id, smooth) {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    openMenuForAnchor(id);
    const top = el.getBoundingClientRect().top + window.pageYOffset - OFFSET;
    window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }
  function setMenuPanel(key, expanded) {
    if (!key) return;
    const toggle = document.querySelector('[data-menu-toggle="' + key + '"]');
    if (expanded && toggle && toggle.dataset.menuLevel === "root") {
      document.querySelectorAll('[data-menu-toggle][data-menu-level="root"]').forEach((button) => {
        if (button.dataset.menuToggle === key) return;
        button.setAttribute("aria-expanded", "false");
        document.querySelectorAll('[data-menu-panel="' + button.dataset.menuToggle + '"]').forEach((panel) => {
          panel.hidden = true;
        });
      });
    }
    document.querySelectorAll("[data-menu-panel]").forEach((panel) => {
      if (panel.dataset.menuPanel === key) {
        panel.hidden = !expanded;
      }
    });
    document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
      if (button.dataset.menuToggle === key) {
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
    });
  }
  function openMenuForAnchor(id) {
    let matched = false;
    document.querySelectorAll('a.sidebar-sub-link[href^="#"]').forEach((link) => {
      if (link.getAttribute("href") !== "#" + id) return;
      matched = true;
      let panel = link.closest("[data-menu-panel]");
      while (panel) {
        setMenuPanel(panel.dataset.menuPanel, true);
        panel = panel.parentElement ? panel.parentElement.closest("[data-menu-panel]") : null;
      }
    });
    if (!matched && id.startsWith("scope-")) {
      const scope = id.slice("scope-".length);
      const panel = document.querySelector('[data-menu-scope="' + scope + '"]');
      if (panel) {
        setMenuPanel(panel.dataset.menuPanel, true);
      }
    }
  }
  function openInitialMenu() {
    const initial = document.querySelector("[data-menu-default]");
    if (initial) {
      setMenuPanel(initial.dataset.menuToggle, true);
    }
  }
  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.menuToggle;
      const expanded = button.getAttribute("aria-expanded") === "true";
      setMenuPanel(key, !expanded);
    });
  });
  document.querySelectorAll("a.sidebar-sub-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      event.preventDefault();
      const id = href.slice(1);
      history.replaceState(null, "", href);
      scrollToAnchor(id, true);
    });
  });
  document.querySelector(".back-to-top")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("hashchange", () => {
    scrollToAnchor(window.location.hash.slice(1), false);
  });
  if (window.location.hash) {
    setTimeout(() => scrollToAnchor(window.location.hash.slice(1), false), 0);
  } else {
    openInitialMenu();
  }
})();
</script>
</body>
</html>`;
    }

    private getVisibleScopes(scopes: Map<string, TokenEntry[]>): Map<string, TokenEntry[]> {
        return new Map([...scopes.entries()].filter(([scope]) => scope !== "component"));
    }

    private getVisibleThemes(themes: ThemeBucket[]): ThemeBucket[] {
        return themes
            .map((theme) => ({
                name: theme.name,
                entries: theme.entries.filter((entry) => entry.scope !== "component"),
            }))
            .filter((theme) => theme.entries.length > 0);
    }

    private renderMenu(scopes: Map<string, TokenEntry[]>, themes: ThemeBucket[]): string {
        if (themes.length > 0) {
            return this.renderThemedMenu(themes);
        }

        return this.renderScopeMenu(scopes);
    }

    private renderThemedMenu(themes: ThemeBucket[]): string {
        let html = "";
        for (const [index, theme] of themes.entries()) {
            const themeKey = this.sectionId("menu-theme", theme.name);
            html += `<section class="sidebar-group sidebar-group--theme">\n`;
            html += this.renderSidebarToggle(theme.name, themeKey, "sidebar-toggle--theme", "root", index === 0);
            html += `<div class="sidebar-group-body sidebar-group-body--theme" data-menu-panel="${this.esc(themeKey)}" hidden>\n`;

            const themeScopes = this.getVisibleScopes(this.#classifier.groupEntriesByScope(theme.entries));
            for (const [scope, tokens] of this.#classifier.getOrderedScopes(themeScopes)) {
                const scopeKey = this.sectionId("menu-theme-scope", `${theme.name}-${scope}`);
                html += `<section class="sidebar-group sidebar-group--nested">\n`;
                html += this.renderSidebarToggle(scope, scopeKey, "sidebar-toggle--scope", "nested", false);
                html += `<div class="sidebar-group-body sidebar-group-body--scope" data-menu-panel="${this.esc(scopeKey)}" data-menu-scope="${this.esc(scope)}" hidden>\n`;

                if (scope === "semantic") {
                    html += this.renderSemanticMenuLinks(tokens, `semantic-${theme.name}`);
                } else {
                    html += this.renderMenuGroupLinks(`${scope}-${theme.name}`, tokens);
                }

                html += `</div>\n`;
                html += `</section>\n`;
            }

            html += `</div>\n`;
            html += `</section>\n`;
        }
        return html;
    }

    private renderScopeMenu(scopes: Map<string, TokenEntry[]>): string {
        let html = "";
        for (const [index, [scope, tokens]] of this.#classifier.getOrderedScopes(scopes).entries()) {
            const scopeKey = this.sectionId("menu-scope", scope);
            html += `<section class="sidebar-group">\n`;
            html += this.renderSidebarToggle(scope, scopeKey, "sidebar-toggle--scope", "root", index === 0);
            html += `<div class="sidebar-group-body sidebar-group-body--scope" data-menu-panel="${this.esc(scopeKey)}" data-menu-scope="${this.esc(scope)}" hidden>\n`;

            if (scope === "semantic") {
                html += this.renderSemanticMenuLinks(tokens);
            } else {
                html += this.renderMenuGroupLinks(scope, tokens);
            }

            html += `</div>\n`;
            html += `</section>\n`;
        }
        return html;
    }

    private renderSemanticMenuLinks(tokens: TokenEntry[], idPrefix = "semantic"): string {
        return this.groupSemanticTokens(tokens)
            .map((group) => {
                const subId = this.sectionId(`${idPrefix}-group-title`, group.key);
                return `<a class="sidebar-sub-link" href="#${this.esc(subId)}">${this.esc(group.title)}</a>`;
            })
            .join("\n");
    }

    private renderSidebarToggle(
        label: string,
        key: string,
        modifier: string,
        level: "root" | "nested",
        isDefault: boolean,
    ): string {
        const defaultAttr = isDefault ? ` data-menu-default="true"` : "";
        return `<button class="sidebar-link sidebar-toggle ${this.esc(modifier)}" type="button" data-menu-toggle="${this.esc(key)}" data-menu-level="${this.esc(level)}" aria-expanded="false"${defaultAttr}><span class="sidebar-chevron" aria-hidden="true"></span>${this.renderFolderIcon()}<span class="sidebar-label">${this.esc(label)}</span></button>\n`;
    }

    private renderFolderIcon(): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide-icon lucide lucide-folder" aria-hidden="true"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>`;
    }

    private renderThemeSummary(themes: ThemeBucket[]): string {
        if (themes.length === 0) {
            return "";
        }

        const baseTokens = new Map(themes[0]?.entries.map((entry) => [entry.name, entry.value]) ?? []);
        const cards = themes
            .map((theme, index) => {
                const overrides = index === 0
                    ? 0
                    : theme.entries.filter((entry) => baseTokens.has(entry.name) && baseTokens.get(entry.name) !== entry.value).length;

                return `<article class="theme-summary-card"><div class="theme-summary-header"><span class="theme-summary-label">Theme name:</span><span class="theme-summary-name">${this.esc(theme.name)}</span></div><dl class="theme-summary-stats"><div><dt>Tokens</dt><dd>${theme.entries.length}</dd></div><div><dt>Overrides</dt><dd>${overrides}</dd></div></dl></article>`;
            })
            .join("\n");

        return `<section class="theme-summary"><div class="theme-summary-title">Theme statistics</div><div class="theme-summary-grid">${cards}</div></section>\n`;
    }

    private renderTokens(
        scopes: Map<string, TokenEntry[]>,
        themes: ThemeBucket[],
        entries: ScopedTokenEntry[],
    ): string {
        if (themes.length > 0) {
            return this.renderThemedTokens(themes, entries);
        }

        let html = "";
        for (const [scope, tokens] of this.#classifier.getOrderedScopes(scopes)) {
            html += `<section class="token-section" id="${this.esc(this.sectionId("scope", scope))}">\n`;
            if (scope === "semantic") {
                html += this.renderSemanticTokens(tokens, entries);
            } else {
                html += `<h2 class="token-category">${this.esc(scope)}</h2>\n`;
                html += this.renderGroupedTokens(tokens, scope);
            }
            html += `</section>\n`;
        }

        return html;
    }

    private renderThemedTokens(themes: ThemeBucket[], entries: ScopedTokenEntry[]): string {
        let html = "";
        for (const theme of themes) {
            html += `<section class="theme-section" id="${this.esc(this.sectionId("primitive-theme", theme.name))}">\n`;
            html += `<h3 class="theme-title">Theme: ${this.esc(theme.name)}</h3>\n`;
            const themeScopes = this.getVisibleScopes(this.#classifier.groupEntriesByScope(theme.entries));
            for (const [scope, tokens] of this.#classifier.getOrderedScopes(themeScopes)) {
                html += `<section class="token-section token-section--theme-scope" id="${this.esc(this.sectionId("scope", `${theme.name}-${scope}`))}">\n`;
                html += `<h2 class="token-category">${this.esc(scope)}</h2>\n`;
                if (scope === "semantic") {
                    html += this.renderSemanticTokens(tokens, entries, `semantic-${theme.name}`);
                } else {
                    html += this.renderGroupedTokens(tokens, `${scope}-${theme.name}`);
                }
                html += `</section>\n`;
            }
            html += `</section>\n`;
        }
        return html;
    }

    private renderSemanticTokens(tokens: TokenEntry[], entries: ScopedTokenEntry[], idPrefix = "semantic"): string {
        const tokenMap = this.createTokenMap(entries);
        const groups = this.groupSemanticTokens(tokens);
        if (groups.length === 0) {
            return "";
        }

        let html = `<section class="semantic-section">\n`;
        html += `<header class="section-header">\n`;
        html += `<h2>Semantic roles</h2>\n`;
        html += `<p>Semantic tokens describe how primitive values are used in the design system.</p>\n`;
        html += `</header>\n`;
        html += `<div class="semantic-groups">\n`;

        for (const group of groups) {
            html += `<section class="semantic-group">\n`;
            html += `<h3 id="${this.esc(this.sectionId(`${idPrefix}-group-title`, group.key))}">${this.esc(group.title)}</h3>\n`;
            html += group.tokens
                .map((token) => this.renderSemanticRole(group.key, token, tokenMap))
                .join("");
            html += `</section>\n`;
        }

        html += `</div>\n`;
        html += `</section>\n`;
        return html;
    }

    private groupSemanticTokens(tokens: TokenEntry[]): SemanticGroup[] {
        const grouped = new Map<string, TokenEntry[]>();

        for (const token of this.dedupeTokens(tokens)) {
            const parts = this.cssVariableToTokenPath(token.name).segments();
            if (parts[0] !== "semantic") {
                continue;
            }

            const key = this.getSemanticGroupKey(parts);
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(token);
        }

        const result: SemanticGroup[] = [];
        for (const key of TokenHtmlShowcaseRenderer.#SEMANTIC_GROUP_ORDER) {
            const groupTokens = grouped.get(key);
            if (!groupTokens || groupTokens.length === 0) {
                continue;
            }
            result.push({
                key,
                title: TokenHtmlShowcaseRenderer.#SEMANTIC_GROUP_TITLES.get(key) ?? key,
                tokens: [...groupTokens].sort((left, right) => left.name.localeCompare(right.name)),
            });
        }

        return result;
    }

    private renderSemanticRole(
        groupKey: string,
        token: TokenEntry,
        tokenMap: Map<string, string>,
    ): string {
        const path = this.cssVariableToTokenPath(token.name);
        const roleName = this.getSemanticRoleName(path);
        const resolved = this.resolveTokenValue(token.value, tokenMap);
        const directRefs = this.extractVarReferences(token.value);
        const warningMessages = this.getSemanticWarnings(directRefs, resolved.unresolvedRefs);
        const roleType = this.getSemanticRoleType(groupKey);
        const preview = this.renderSemanticPreview(roleType, resolved.value);
        const aliasLine = directRefs.length > 0
            ? `<div class="semantic-role__meta semantic-role__meta--alias"><span>value:</span> <code>${this.renderLinkedTokenValue(token.value)}</code></div>\n`
            : "";
        const references = this.renderSemanticReferences(token.value, tokenMap);
        const warnings = warningMessages
            .map((message) => `<span class="semantic-role__warning">${this.esc(message)}</span>`)
            .join("");
        const plainClass = preview ? "" : " semantic-role--plain";

        return `<article class="semantic-role semantic-role--${this.esc(roleType)}${plainClass}" data-token-name="${this.esc(token.name)}">\n`
            + `${preview}\n`
            + `<div class="semantic-role__content">\n`
            + `<div class="semantic-role__header"><div class="semantic-role__name">${this.esc(roleName)}</div>${warnings}</div>\n`
            + `${aliasLine}`
            + `${references}`
            + `<div class="semantic-role__meta semantic-role__meta--resolved"><span>resolved:</span> <code>${this.esc(resolved.value || "unresolved")}</code></div>\n`
            + `<div class="semantic-role__meta semantic-role__meta--role"><span>css:</span> <code class="semantic-role__token">${this.esc(token.name)}</code></div>\n`
            + `</div>\n`
            + `</article>\n`;
    }

    private renderSemanticPreview(roleType: string, resolvedValue: string): string {
        if (roleType === "color") {
            if (this.isRenderableColor(resolvedValue)) {
                return `<span class="semantic-role__swatch" style="background:${this.esc(resolvedValue)}"></span>`;
            }
            return `<span class="semantic-role__swatch semantic-role__swatch--empty"></span>`;
        }

        return "";
    }

    private renderSemanticReferences(value: string, tokenMap: Map<string, string>): string {
        const refs = this.extractVarReferences(value);
        if (refs.length > 1) {
            return this.renderSemanticParts(refs);
        }

        if (refs.length === 1) {
            const nestedRefs = this.extractVarReferences(tokenMap.get(refs[0]) ?? "");
            if (nestedRefs.length > 1) {
                return this.renderSemanticParts(nestedRefs);
            }
        }

        return "";
    }

    private renderSemanticParts(refs: string[]): string {
        const uniqueRefs = [...new Set(refs)];
        const items = uniqueRefs
            .map((ref) => {
                const tokenPath = this.cssVariableToTokenPath(ref).toString();
                return `<span><code>${this.esc(this.getCompositePartName(ref))}</code><a class="semantic-role__ref" href="#${this.esc(this.tokenId(ref))}" title="${this.esc(tokenPath)}">${this.esc(tokenPath)}</a></span>`;
            })
            .join("");

        return `<div class="semantic-role__parts"><span class="semantic-role__parts-label">parts:</span>${items}</div>\n`;
    }

    private renderLinkedTokenValue(value: string): string {
        const pattern = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)/g;
        let html = "";
        let lastIndex = 0;

        for (const match of value.matchAll(pattern)) {
            const index = match.index ?? 0;
            html += this.esc(value.slice(lastIndex, index));
            const ref = match[1];
            const raw = match[0];
            if (!ref.startsWith("--primitive-")) {
                html += this.esc(raw);
            } else {
                html += `<a class="semantic-role__ref" href="#${this.esc(this.tokenId(ref))}" title="${this.esc(ref)}">${this.esc(raw)}</a>`;
            }
            lastIndex = index + raw.length;
        }

        html += this.esc(value.slice(lastIndex));
        return html;
    }

    private getCompositePartName(ref: string): string {
        const normalized = ref.replace(/^--/, "");
        const match = normalized.match(/-(width|style|color|duration|delay|timingFunction-\d+|offsetX|offsetY|blur|spread|fontSize|fontWeight|lineHeight|letterSpacing|fontFamily-\d+)$/);
        if (!match) {
            return "value";
        }
        return match[1];
    }

    private getSemanticWarnings(directRefs: string[], unresolvedRefs: string[]): string[] {
        const warnings: string[] = [];
        if (directRefs.some((ref) => this.cssVariableToTokenPath(ref).head() === "component")) {
            warnings.push("warning: references component token");
        }
        if (unresolvedRefs.length > 0) {
            warnings.push("warning: unresolved reference");
        }
        return warnings;
    }

    private resolveTokenValue(
        value: string,
        tokenMap: Map<string, string>,
        stack: string[] = [],
    ): ResolvedTokenValue {
        const unresolvedRefs: string[] = [];
        const resolved = value.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)/g, (_match, ref: string) => {
            const aggregate = this.resolveAggregateTokenValue(ref, tokenMap);
            if (aggregate) {
                return aggregate;
            }

            if (stack.includes(ref) || !tokenMap.has(ref)) {
                unresolvedRefs.push(ref);
                return `var(${ref})`;
            }

            const nested = this.resolveTokenValue(tokenMap.get(ref)!, tokenMap, [...stack, ref]);
            unresolvedRefs.push(...nested.unresolvedRefs);
            return nested.value;
        }).replace(/\s+/g, " ").trim();

        return { value: resolved, unresolvedRefs };
    }

    private resolveAggregateTokenValue(ref: string, tokenMap: Map<string, string>): string | null {
        if (tokenMap.has(ref)) {
            return null;
        }

        const typography = this.resolveAggregateTypographyTokenValue(ref, tokenMap);
        if (typography) {
            return typography;
        }

        const gradient = this.resolveAggregateGradientTokenValue(ref, tokenMap);
        if (gradient) {
            return gradient;
        }

        return null;
    }

    private resolveAggregateGradientTokenValue(ref: string, tokenMap: Map<string, string>): string | null {
        const prefix = `${ref}-`;
        const stops = this.collectGradientStops(prefix, tokenMap);
        if (stops.length === 0 || !ref.includes("-gradient-")) {
            return null;
        }

        const formattedStops = stops
            .map((stop) => `${stop.color} ${this.formatGradientPosition(stop.position)}`.trim())
            .join(", ");

        return `linear-gradient(90deg, ${formattedStops})`;
    }

    private collectGradientStops(prefix: string, tokenMap: Map<string, string>): Array<{ color: string; position?: string }> {
        const stops = new Map<number, { color?: string; position?: string }>();
        const pattern = new RegExp(`^${this.escapeRegExp(prefix)}(\\d+)-(color|position)$`);

        for (const [name, value] of tokenMap) {
            const match = name.match(pattern);
            if (!match) {
                continue;
            }

            const index = Number(match[1]);
            const stop = stops.get(index) ?? {};
            if (match[2] === "color") {
                stop.color = value;
            } else {
                stop.position = value;
            }
            stops.set(index, stop);
        }

        return [...stops.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, stop]) => stop)
            .filter((stop): stop is { color: string; position?: string } => Boolean(stop.color));
    }

    private resolveAggregateTypographyTokenValue(ref: string, tokenMap: Map<string, string>): string | null {
        const prefix = `${ref}-`;
        const matchingParts = [...tokenMap.keys()].filter((name) => name.startsWith(prefix));
        if (matchingParts.length === 0 || !ref.includes("-typography-")) {
            return null;
        }

        const family = this.collectIndexedValues(prefix, "fontFamily", tokenMap).join(", ");
        const size = tokenMap.get(`${prefix}fontSize`);
        const weight = this.normalizeFontWeight(tokenMap.get(`${prefix}fontWeight`));
        const lineHeight = tokenMap.get(`${prefix}lineHeight`);
        const letterSpacing = tokenMap.get(`${prefix}letterSpacing`);

        const parts: string[] = [];
        if (weight) {
            parts.push(weight);
        }
        if (size) {
            parts.push(lineHeight ? `${size}/${lineHeight}` : size);
        }
        if (family) {
            parts.push(family);
        }

        if (parts.length === 0) {
            return null;
        }

        if (letterSpacing) {
            return `${parts.join(" ")}; letter-spacing ${letterSpacing}`;
        }
        return parts.join(" ");
    }

    private collectIndexedValues(prefix: string, property: string, tokenMap: Map<string, string>): string[] {
        const values: Array<{ index: number; value: string }> = [];
        const pattern = new RegExp(`^${this.escapeRegExp(prefix + property)}-(\\d+)$`);

        for (const [name, value] of tokenMap) {
            const match = name.match(pattern);
            if (!match) {
                continue;
            }
            values.push({ index: Number(match[1]), value });
        }

        return values
            .sort((left, right) => left.index - right.index)
            .map((item) => item.value);
    }

    private normalizeFontWeight(value?: string): string | undefined {
        if (value === "regular") {
            return "400";
        }
        return value;
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private extractVarReferences(value: string): string[] {
        return [...value.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]+)?\)/g)]
            .map((match) => match[1]);
    }

    private createTokenMap(entries: ScopedTokenEntry[]): Map<string, string> {
        const map = new Map<string, string>();
        for (const entry of entries) {
            if (!map.has(entry.name)) {
                map.set(entry.name, entry.value);
            }
        }
        return map;
    }

    private dedupeTokens(tokens: TokenEntry[]): TokenEntry[] {
        const seen = new Set<string>();
        const result: TokenEntry[] = [];
        for (const token of tokens) {
            if (seen.has(token.name)) {
                continue;
            }
            seen.add(token.name);
            result.push(token);
        }
        return result;
    }

    private cssVariableToTokenPath(name: string): TokenPath {
        return TokenPath.parse(name.replace(/^--/, "").replace(/-/g, "."));
    }

    private getSemanticGroupKey(parts: readonly string[]): string {
        const prefix = parts.slice(1, 3).join(".");
        if (TokenHtmlShowcaseRenderer.#SEMANTIC_GROUP_TITLES.has(prefix)) {
            return prefix;
        }
        if (parts[1] === "text") {
            return "text";
        }
        if (parts[1] === "motion") {
            return "motion";
        }
        return "other";
    }

    private getSemanticRoleName(path: TokenPath): string {
        const parts = path.segments();
        if (parts[0] !== "semantic") {
            return path.toString();
        }
        if (parts[1] === "color" || parts[1] === "space" || parts[1] === "shape") {
            return parts.slice(2).join(".");
        }
        return parts.slice(1).join(".");
    }

    private getSemanticRoleType(groupKey: string): string {
        if (groupKey.startsWith("color.")) {
            return "color";
        }
        if (groupKey.startsWith("space.")) {
            return "spacing";
        }
        if (groupKey === "shape.radius") {
            return "radius";
        }
        if (groupKey === "text") {
            return "text";
        }
        if (groupKey === "motion") {
            return "motion";
        }
        return "other";
    }

    private isRenderableColor(value: string): boolean {
        const normalized = value.trim();
        return TokenHtmlShowcaseRenderer.#COLOR_HEX_RE.test(normalized)
            || /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|color)\(/i.test(normalized)
            || normalized === "transparent"
            || normalized === "currentColor";
    }

    private renderGroupedTokens(tokens: TokenEntry[], idPrefix: string): string {
        let html = "";
        for (const groupInfo of this.getDisplayGroups(tokens)) {
            html += `<section class="token-subgroup">\n`;
            html += `<h3 class="token-subgroup-title" id="${this.esc(this.sectionId(`${idPrefix}-group-title`, groupInfo.key))}">${this.esc(groupInfo.title)}</h3>\n`;
            const listClass = groupInfo.group === "fonts" || groupInfo.group === "typography" || groupInfo.kind === "fontCollection"
                ? "token-list token-list--font"
                : "token-list";
            html += `<div class="${listClass}">\n`;
            html += groupInfo.kind === "fontCollection"
                ? groupInfo.tokens
                    .map((entry) => this.renderFontVariantCard(this.toFontVariantCard(groupInfo.key, entry)))
                    .join("")
                : this.renderGroupItems(groupInfo.group, groupInfo.tokens);
            html += `</div>\n`;
            html += `</section>\n`;
        }
        return html;
    }

    private getDisplayGroups(tokens: TokenEntry[]): DisplayTokenGroup[] {
        const grouped = this.#classifier.groupTokens(tokens);
        const groups: DisplayTokenGroup[] = [];

        for (const [group, groupTokens] of grouped) {
            if (group === "fonts") {
                groups.push(...this.#fontAggregator.aggregate(groupTokens).map((collection) => ({
                    key: collection.key,
                    title: collection.title,
                    group,
                    tokens: collection.entries,
                    kind: "fontCollection" as const,
                })));
            } else {
                groups.push({
                    key: group,
                    title: group,
                    group,
                    tokens: groupTokens,
                    kind: "tokens",
                });
            }
        }

        return groups.sort((left, right) => left.title.localeCompare(right.title));
    }

    private renderMenuGroupLinks(idPrefix: string, tokens: TokenEntry[]): string {
        return this.getDisplayGroups(tokens)
            .map((group) => {
                const subId = this.sectionId(`${idPrefix}-group-title`, group.key);
                return `<a class="sidebar-sub-link" href="#${this.esc(subId)}">${this.esc(group.title)}</a>`;
            })
            .join("\n");
    }

    private sectionId(prefix: string, value: string): string {
        return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    }

    private tokenId(name: string): string {
        return this.sectionId("token", name.replace(/^--/, ""));
    }



    private renderGroupItems(group: string, tokens: TokenEntry[]): string {
        if (group === "borders") {
            return this.renderBorderItems(tokens);
        }

        if (group === "typography") {
            return this.renderTypographyItems(tokens);
        }

        if (group === "shadows") {
            return this.renderShadowItems(tokens);
        }

        if (group === "gradients") {
            return this.renderGradientItems(tokens);
        }

        if (group === "motion") {
            return this.renderMotionItems(tokens);
        }

        return tokens
            .map((token) => this.renderTokenItem(group, token.name, token.value))
            .join("");
    }

    private renderBorderItems(tokens: TokenEntry[]): string {
        const aggregated = this.#borderAggregator.aggregate(tokens);

        return [
            ...aggregated.borders.map((item) => this.renderBorderItem(item)),
            ...aggregated.borderWidths.map((item) => this.renderBorderWidthItem(item)),
            ...aggregated.strokeStyles.map((item) => this.renderStrokeStyleItem(item)),
            ...aggregated.fallback.map((token) => this.renderTokenItem("borders", token.name, token.value)),
        ].join("");
    }

    private renderTypographyItems(tokens: TokenEntry[]): string {
        const items = this.#typographyAggregator.aggregate(tokens);
        return items
            .map((item) => this.renderTokenItem("typography", item.name, item.value, item.typography))
            .join("");
    }

    private renderShadowItems(tokens: TokenEntry[]): string {
        const aggregated = this.#shadowAggregator.aggregate(tokens);
        return [
            ...aggregated.items.map((item) => this.renderShadowItem(item)),
            ...aggregated.fallback.map((token) => this.renderTokenItem("shadows", token.name, token.value)),
        ].join("");
    }

    private renderGradientItems(tokens: TokenEntry[]): string {
        const aggregated = this.#gradientAggregator.aggregate(tokens);
        return [
            ...aggregated.items.map((item) => this.renderGradientItem(item)),
            ...aggregated.fallback.map((token) => this.renderTokenItem("gradients", token.name, token.value)),
        ].join("");
    }

    private renderMotionItems(tokens: TokenEntry[]): string {
        const aggregated = this.#transitionAggregator.aggregate(tokens);
        return [
            ...aggregated.items.map((item) => this.renderTransitionItem(item)),
            ...aggregated.fallback.map((token) => this.renderMotionTokenItem(token.name, token.value)),
        ].join("");
    }

    private getFontCollectionEntryLabel(name: string, key: string): string {
        const normalized = name.replace(/^--/, "");
        const match = normalized.match(new RegExp(`${key}-([a-z0-9-]+)$`, "i"));
        return match?.[1] ?? normalized;
    }

    private toFontVariantCard(key: string, entry: TokenEntry): FontVariantCard {
        const label = this.getFontCollectionEntryLabel(entry.name, key);
        const title = this.toTitleCase(label.replace(/-/g, " "));
        const metaLabel = this.getFontCollectionMetaLabel(key);

        return {
            name: title,
            value: entry.value,
            previewStyle: this.getFontVariantPreviewStyle(key, entry.value),
            previewClassName: this.getFontVariantPreviewClassName(key, entry.value),
            metaLabel,
        };
    }

    private getFontCollectionMetaLabel(key: string): string {
        if (key === "font-family") {
            return "Font";
        }
        if (key === "font-weight") {
            return "Weight";
        }
        if (key === "font-size") {
            return "Size";
        }
        if (key === "line-height") {
            return "Line height";
        }
        if (key === "letter-spacing") {
            return "Letter spacing";
        }
        return "Value";
    }

    private getFontVariantPreviewStyle(key: string, value: string): string {
        const base = [
            "font-family: Inter, Arial, sans-serif",
            "font-size: 24px",
            "line-height: 1.6",
            "font-weight: 400",
            "letter-spacing: 0",
        ];

        if (key === "font-family") {
            base[0] = `font-family: ${this.esc(value)}`;
        } else if (key === "font-weight") {
            base[3] = `font-weight: ${this.esc(value)}`;
        } else if (key === "font-size") {
            base[1] = `font-size: ${this.esc(value)}`;
        } else if (key === "line-height") {
            base[2] = `line-height: ${this.esc(value)}`;
        } else if (key === "letter-spacing") {
            base[4] = `letter-spacing: ${this.esc(value)}`;
        } else {
            return "";
        }

        return base.join(";");
    }

    private getFontVariantPreviewClassName(key: string, value: string): string {
        if (key !== "font-size") {
            return "";
        }

        const tier = this.getFontSizePreviewTier(value);
        return tier ? ` font-preview--font-size font-preview--${tier}` : " font-preview--font-size";
    }

    private getFontSizePreviewTier(value: string): string {
        const normalized = value.trim().toLowerCase();
        const match = normalized.match(/^(-?\d*\.?\d+)(px|rem)$/);
        if (!match) {
            return "";
        }

        const amount = Number(match[1]);
        const pixels = match[2] === "rem" ? amount * 16 : amount;

        if (pixels >= 48) {
            return "4xl";
        }
        if (pixels >= 36) {
            return "3xl";
        }
        if (pixels >= 28) {
            return "2xl";
        }
        if (pixels >= 22) {
            return "xl";
        }

        return "";
    }

    private renderFontVariantCard(card: FontVariantCard): string {
        const badge = this.renderGroupBadge("fonts");
        return `<div class="token-item token-item--font-card">${badge}<div class="font-preview font-preview--grid${card.previewClassName ?? ""}" style="${card.previewStyle ?? ""}">${this.esc(TokenHtmlShowcaseRenderer.#FONT_PREVIEW_TEXT)}</div><span class="token-name token-name--font-card">${this.esc(card.name)}</span><div class="token-meta"><span><b>${this.esc(card.metaLabel)}:</b> <span class="token-meta-value">${this.esc(card.value)}</span></span></div></div>\n`;
    }

    private renderBorderItem(item: BorderTokenInfo): string {
        const badge = this.renderGroupBadge("borders");
        const title = this.toTitleCase(item.name.replace(/^.*-border-/, "").replace(/-/g, " "));
        const color = item.color ?? "currentColor";
        const width = item.width ?? "1px";
        const style = item.style ?? "solid";
        const resolved = `${width} ${style} ${color}`;
        const previewStyle = `border:${this.esc(resolved)}`;
        const value = item.value ? this.renderMetaLine("value", item.value) : "";
        const resolvedLine = this.renderMetaLine("resolved", resolved);

        return `<div class="token-item token-item--border-card" id="${this.esc(this.tokenId(`--${item.name}`))}">${badge}<div class="border-preview border-preview--grid"><div class="border-preview-box" style="${previewStyle}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta token-meta--stack">${value}${resolvedLine}<span><b>Color:</b> <span class="token-meta-value">${this.esc(color)}</span></span><span><b>Width:</b> <span class="token-meta-value">${this.esc(width)}</span></span><span><b>Style:</b> <span class="token-meta-value">${this.esc(style)}</span></span></div></div>\n`;
    }

    private renderShadowItem(item: ShadowTokenInfo): string {
        const badge = this.renderGroupBadge("shadows");
        const title = this.toTitleCase(item.name.replace(/^.*-shadow-/, "").replace(/-/g, " "));
        const layers = item.layers.map((layer) => this.formatShadowLayer(layer));
        const boxShadow = layers.join(", ");
        const value = item.value ? this.renderMetaLine("value", item.value) : "";
        const resolved = this.renderMetaLine("resolved", boxShadow);
        const details = layers
            .map((layer, index) => `<span class="shadow-layer"><b>Layer ${index + 1}:</b> <span class="token-meta-value">${this.esc(layer)}</span></span>`)
            .join("");

        return `<div class="token-item token-item--shadow-card" id="${this.esc(this.tokenId(`--${item.name}`))}" data-token-name="${this.esc(`--${item.name}`)}">${badge}<div class="shadow-preview shadow-preview--grid"><div class="shadow-preview-box" style="box-shadow:${this.esc(boxShadow)}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta token-meta--stack">${value}${resolved}${details}</div></div>\n`;
    }

    private renderGradientItem(item: GradientTokenInfo): string {
        const badge = this.renderGroupBadge("gradients");
        const title = this.toTitleCase(item.name.replace(/^.*-gradient-/, "").replace(/-/g, " "));
        const gradient = this.formatGradientValue(item);
        const value = item.value ? this.renderMetaLine("value", item.value) : "";
        const resolved = this.renderMetaLine("resolved", gradient);
        const stops = this.renderGradientStops(item);

        return `<div class="token-item token-item--gradient-card" id="${this.esc(this.tokenId(`--${item.name}`))}" data-token-name="${this.esc(`--${item.name}`)}">${badge}<div class="token-swatch" style="background:${this.esc(gradient)}"></div><span class="token-name">${this.esc(title)}</span>${stops}<div class="token-meta token-meta--stack">${value}${resolved}</div></div>\n`;
    }

    private renderGradientStops(item: GradientTokenInfo): string {
        if (item.stops.length === 0) {
            return "";
        }

        const stops = item.stops
            .map((stop) => {
                const color = stop.color ?? "transparent";
                const position = this.formatGradientPosition(stop.position);
                const label = position ? `${color} ${position}` : color;
                return `<span class="gradient-stop"><span class="gradient-stop__swatch token-swatch" style="background:${this.esc(color)}"></span><span class="gradient-stop__value">${this.esc(label)}</span></span>`;
            })
            .join("");

        return `<div class="gradient-stops" aria-label="${this.esc(item.name)} gradient colors">${stops}</div>`;
    }

    private renderTransitionItem(item: TransitionTokenInfo): string {
        const title = this.toTitleCase(item.name.replace(/^.*-transition-/, "").replace(/-/g, " "));
        const duration = item.duration ?? this.extractDurationValue(item.value) ?? "1200ms";
        const delay = item.delay ?? "0ms";
        const timing = this.formatTransitionTiming(item.timingFunction, item.value);
        const hasResolvedParts = Boolean(item.duration || item.delay || item.timingFunction.length > 0);
        const resolved = hasResolvedParts ? `${duration} ${timing} ${delay}` : undefined;

        return this.renderMotionCard({
            name: `--${item.name}`,
            title,
            duration,
            delay,
            timing,
            value: item.value,
            resolved,
        });
    }

    private renderMotionTokenItem(name: string, value: string): string {
        const title = this.toMotionTitle(name);
        const duration = this.getMotionPreviewDuration(name, value);
        const timing = this.getMotionPreviewTiming(name, value);
        const resolved = this.getMotionResolvedValue(name, value, duration, timing, "0ms");

        return this.renderMotionCard({
            name,
            title,
            duration,
            delay: "0ms",
            timing,
            value,
            resolved,
        });
    }

    private renderMotionCard(info: {
        name: string;
        title: string;
        duration: string;
        delay: string;
        timing: string;
        value?: string;
        resolved?: string;
    }): string {
        const badge = this.renderGroupBadge("motion");
        const style = [
            `--motion-duration:${this.esc(this.normalizeMotionDuration(info.duration))}`,
            `--motion-delay:${this.esc(info.delay)}`,
            `--motion-timing:${this.esc(info.timing)}`,
        ].join(";");
        const value = info.value
            ? `<span><b>value:</b> <span class="token-meta-value">${this.esc(info.value)}</span></span>`
            : "";
        const resolved = info.resolved && info.resolved !== info.value
            ? this.renderMetaLine("resolved", info.resolved)
            : "";

        return `<div class="token-item token-item--motion-card" id="${this.esc(this.tokenId(info.name))}" data-token-name="${this.esc(info.name)}">${badge}<div class="motion-preview motion-preview--grid" style="${style}"><div class="motion-track"><div class="motion-dot"></div></div></div><span class="token-name token-name--font-card">${this.esc(info.title)}</span><div class="token-meta token-meta--stack"><span><b>Duration:</b> <span class="token-meta-value">${this.esc(info.duration)}</span></span><span><b>Delay:</b> <span class="token-meta-value">${this.esc(info.delay)}</span></span><span><b>Timing:</b> <span class="token-meta-value">${this.esc(info.timing)}</span></span>${value}${resolved}</div></div>\n`;
    }

    private renderMetaLine(label: string, value: string): string {
        return `<span><b>${this.esc(label)}:</b> <span class="token-meta-value">${this.esc(value)}</span></span>`;
    }

    private formatGradientValue(item: GradientTokenInfo): string {
        if (item.stops.length === 0 && item.value) {
            return item.value;
        }

        const stops = item.stops
            .map((stop) => `${stop.color ?? "transparent"} ${this.formatGradientPosition(stop.position)}`)
            .join(", ");

        return `linear-gradient(90deg, ${stops})`;
    }

    private formatGradientPosition(position?: string): string {
        if (!position) {
            return "";
        }
        if (/^-?\d+(?:\.\d+)?$/.test(position)) {
            return `${Number(position) * 100}%`;
        }
        return position;
    }

    private formatTransitionTiming(timingFunction: string[], value?: string): string {
        const values = timingFunction.filter((part) => part !== undefined);
        if (values.length === 4) {
            return `cubic-bezier(${values.join(", ")})`;
        }
        if (value?.includes("cubic-bezier")) {
            return value.match(/cubic-bezier\([^)]+\)/)?.[0] ?? "ease";
        }
        return "ease";
    }

    private extractDurationValue(value?: string): string | null {
        if (!value) {
            return null;
        }
        return value.match(/\b\d+(?:\.\d+)?m?s\b/)?.[0] ?? null;
    }

    private getMotionPreviewDuration(name: string, value: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes("duration") && /^\d+(?:\.\d+)?m?s$/.test(value)) {
            return value;
        }
        return this.extractDurationValue(value) ?? "1200ms";
    }

    private getMotionPreviewTiming(name: string, value: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes("cubic-bezier") && /^-?\d/.test(value)) {
            return `cubic-bezier(${value})`;
        }
        if (value.includes("cubic-bezier")) {
            return value.match(/cubic-bezier\([^)]+\)/)?.[0] ?? "ease";
        }
        return "ease";
    }

    private getMotionResolvedValue(
        name: string,
        value: string,
        duration: string,
        timing: string,
        delay: string,
    ): string | undefined {
        const lowerName = name.toLowerCase();
        if (lowerName.includes("cubic-bezier") && /^-?\d/.test(value)) {
            return timing;
        }
        if (value.includes("cubic-bezier")) {
            return `${duration} ${timing} ${delay}`;
        }
        return undefined;
    }

    private normalizeMotionDuration(duration: string): string {
        if (duration === "0ms" || duration === "0s" || duration === "0") {
            return "1ms";
        }
        return duration;
    }

    private toMotionTitle(name: string): string {
        return this.toTitleCase(name
            .replace(/^--/, "")
            .replace(/^.*-(duration|cubic-bezier|transition)-/, "")
            .replace(/-/g, " "));
    }

    private formatShadowLayer(layer: ShadowLayerInfo): string {
        return [
            layer.offsetX ?? "0px",
            layer.offsetY ?? "0px",
            layer.blur ?? "0px",
            layer.spread ?? "0px",
            this.formatShadowColor(layer.color ?? "currentColor"),
        ].join(" ");
    }

    private formatShadowColor(color: string): string {
        const match = color.match(/^#([0-9a-fA-F]{8})$/);
        if (!match) {
            return color;
        }

        const hex = match[1];
        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);
        const alpha = Number.parseInt(hex.slice(6, 8), 16);
        const opacity = Number((alpha / 255).toFixed(2));

        return `rgb(${red} ${green} ${blue} / ${opacity})`;
    }

    private renderBorderWidthItem(item: BorderWidthTokenInfo): string {
        return this.renderDimensionItem("borders", item.name, item.value);
    }

    private renderStrokeStyleItem(item: StrokeStyleTokenInfo): string {
        const badge = this.renderGroupBadge("borders");
        const title = this.toTitleCase(item.name.replace(/^.*-stroke-style-/, "").replace(/-/g, " "));
        const style = item.value ?? (item.dashArray.length > 0 ? "dashed" : "solid");
        const previewStyle = `border:2px ${this.esc(style)} #334155`;
        const dashArray = item.dashArray.filter(Boolean).join(", ");

        return `<div class="token-item token-item--border-card" id="${this.esc(this.tokenId(`--${item.name}`))}">${badge}<div class="border-preview border-preview--grid"><div class="border-preview-box" style="${previewStyle}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta token-meta--stack"><span><b>Style:</b> <span class="token-meta-value">${this.esc(style)}</span></span>${dashArray ? `<span><b>Dash:</b> <span class="token-meta-value">${this.esc(dashArray)}</span></span>` : ""}${item.lineCap ? `<span><b>Line cap:</b> <span class="token-meta-value">${this.esc(item.lineCap)}</span></span>` : ""}</div></div>\n`;
    }

    private renderDimensionItem(group: string, name: string, value: string): string {
        const badge = this.renderGroupBadge(group);
        const title = this.toDimensionTitle(name);
        const markerStyle = this.getDimensionMarkerStyle(value);

        return `<div class="token-item token-item--dimension-card" id="${this.esc(this.tokenId(name))}" data-token-name="${this.esc(name)}">${badge}<div class="dimension-preview dimension-preview--grid"><div class="dimension-marker" style="${markerStyle}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta"><span><b>Dimension:</b> <span class="token-meta-value">${this.esc(value)}</span></span></div></div>\n`;
    }

    private renderRadiusItem(name: string, value: string): string {
        const badge = this.renderGroupBadge("radius");
        const title = this.toDimensionTitle(name);
        const radius = this.esc(value);

        return `<div class="token-item token-item--radius-card" id="${this.esc(this.tokenId(name))}" data-token-name="${this.esc(name)}">${badge}<div class="radius-preview radius-preview--grid"><div class="radius-preview-box" style="border-radius:${radius}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta"><span><b>Radius:</b> <span class="token-meta-value">${this.esc(value)}</span></span></div></div>\n`;
    }

    private renderOpacityItem(name: string, value: string): string {
        const badge = this.renderGroupBadge("opacity");
        const title = this.toTitleCase(name
            .replace(/^--/, "")
            .replace(/^.*-opacity-/, "")
            .replace(/^.*-alpha-/, "")
            .replace(/-/g, " "));
        const opacity = this.parseOpacityValue(value);
        const previewOpacity = opacity ?? 1;
        const resolved = opacity !== null
            ? this.renderMetaLine("resolved", `${Math.round(opacity * 100)}%`)
            : "";

        return `<div class="token-item token-item--opacity-card" id="${this.esc(this.tokenId(name))}" data-token-name="${this.esc(name)}">${badge}<div class="opacity-preview opacity-preview--checker"><div class="opacity-preview-fill" style="opacity:${this.esc(String(previewOpacity))}"></div></div><span class="token-name token-name--font-card">${this.esc(title)}</span><div class="token-meta token-meta--stack">${this.renderMetaLine("value", value)}${resolved}</div></div>\n`;
    }

    private parseOpacityValue(value: string): number | null {
        const normalized = value.trim();
        if (/^\d+(?:\.\d+)?%$/.test(normalized)) {
            return Math.max(0, Math.min(1, Number.parseFloat(normalized) / 100));
        }
        if (/^\d+(?:\.\d+)?$/.test(normalized)) {
            return Math.max(0, Math.min(1, Number.parseFloat(normalized)));
        }
        return null;
    }

    private toDimensionTitle(name: string): string {
        return this.toTitleCase(name
            .replace(/^--/, "")
            .replace(/^.*-dimension-/, "")
            .replace(/-/g, " "));
    }


    private getDimensionMarkerStyle(value: string): string {
        if (value === "0px" || value === "0") {
            return "width:1px;opacity:0.25";
        }
        return `width:${this.esc(value)}`;
    }

    private toTitleCase(value: string): string {
        return value.replace(/\b\w/g, (char) => char.toUpperCase());
    }


    private renderTokenItem(group: string, name: string, value: string, typography?: TypographyTokenInfo): string {
        const lowerName = name.toLowerCase();
        let preview = "";
        let details = "";



        if (group === "colors" || TokenHtmlShowcaseRenderer.#COLOR_HEX_RE.test(value) || value.startsWith("rgb") || value.startsWith("hsl")) {
            preview = `<div class="token-swatch" style="background:${value}"></div>`;
        } else if (group === "gradients") {
            preview = `<div class="token-swatch" style="background:${this.esc(value)}"></div>`;
            details = this.renderGradientStopsFromValue(name, value);
        } else if (group === "fonts" || group === "typography") {
            const typographyInfo = typography ?? this.extractTypographyInfo(name, value);
            const styleParts = this.getTypographyStyleParts(typographyInfo);

            if (group === "typography" && styleParts.length === 0) {
                styleParts.push(`font:${this.esc(value)}`);
            }

            preview = `<div class="font-preview font-preview--grid" style="${styleParts.join(";")}">${this.esc(TokenHtmlShowcaseRenderer.#FONT_PREVIEW_TEXT)}</div>`;
            details = `<div class="token-meta"><span><b>value:</b> <span class="token-meta-value">${this.esc(value)}</span></span></div>`;
        } else if (group === "radius") {
            return this.renderRadiusItem(name, value);
        } else if (group === "opacity") {
            return this.renderOpacityItem(name, value);
        } else if (group === "spacing" || group === "sizes") {
            return this.renderDimensionItem(group, name, value);
        } else if (lowerName.includes("shadow")) {
            preview = `<div class="shadow-visual" style="box-shadow:${value}"></div>`;
        } else if (lowerName.includes("border") || lowerName.includes("stroke")) {
            preview = `<div class="border-visual" style="border:${value}"></div>`;
        } else if (lowerName.includes("gradient")) {
            preview = `<div class="gradient-visual" style="background:${value}"></div>`;
        } else if (lowerName.startsWith("--font-")) {
            const prop = lowerName.slice(2).replace(/-/g, "-");
            preview = `<div class="font-sample" style="${this.esc(prop)}:${this.esc(value)}">Aa</div>`;
        } else if (group === "motion") {
            return this.renderMotionTokenItem(name, value);
        }

        const badge = this.renderGroupBadge(group);
        const valueLine = group === "fonts" || group === "typography"
            ? ""
            : `<div class="token-meta"><span><b>value:</b> <span class="token-meta-value">${this.esc(value)}</span></span></div>`;

        const itemClass = group === "colors"
            ? " token-item--color-card"
            : group === "gradients"
                ? " token-item--gradient-card"
                : "";

        return `<div class="token-item${itemClass}" id="${this.esc(this.tokenId(name))}">${badge}${preview}<span class="token-name">${this.esc(name)}</span>${details}${valueLine}</div>\n`;
    }

    private renderGradientStopsFromValue(name: string, value: string): string {
        const stops = [...value.matchAll(/(#[0-9a-fA-F]{3,8})\s*(-?\d+(?:\.\d+)?%?)?/g)]
            .map((match) => ({
                color: match[1],
                position: match[2],
            }));
        if (stops.length === 0) {
            return "";
        }

        const item: GradientTokenInfo = {
            name: name.replace(/^--/, ""),
            value,
            stops,
        };
        return this.renderGradientStops(item);
    }

    private renderGroupBadge(group: string): string {
        const allowedGroups = new Set([
            "colors",
            "fonts",
            "typography",
            "borders",
            "radius",
            "spacing",
            "shadows",
            "gradients",
            "motion",
            "opacity",
            "sizes",
            "other",
        ]);

        if (!allowedGroups.has(group)) {
            return "";
        }

        return `<span class="token-type-badge">${this.esc(group)}</span>`;
    }

    private getTypographyStyleParts(typographyInfo: TypographyTokenInfo): string[] {
        const styleParts: string[] = [];

        if (typographyInfo.family) {
            styleParts.push(`font-family:${this.esc(typographyInfo.family)}`);
        }
        if (typographyInfo.size) {
            styleParts.push(`font-size:${this.esc(typographyInfo.size)}`);
        }
        if (typographyInfo.weight) {
            styleParts.push(`font-weight:${this.esc(typographyInfo.weight)}`);
        }
        if (typographyInfo.lineHeight) {
            styleParts.push(`line-height:${this.esc(typographyInfo.lineHeight)}`);
        }
        if (typographyInfo.letterSpacing) {
            styleParts.push(`letter-spacing:${this.esc(typographyInfo.letterSpacing)}`);
        }

        return styleParts;
    }

    private extractTypographyInfo(
        name: string,
        value: string,
    ): TypographyTokenInfo {
        const lowerName = name.toLowerCase();
        const info: TypographyTokenInfo = {};

        if (lowerName.includes("family")) {
            info.family = value;
        }
        if (lowerName.includes("size")) {
            info.size = value;
        }
        if (lowerName.includes("weight")) {
            info.weight = value;
        }
        if (lowerName.includes("line-height") || lowerName.includes("lineheight")) {
            info.lineHeight = value;
        }
        if (lowerName.includes("letter-spacing") || lowerName.includes("tracking")) {
            info.letterSpacing = value;
        }

        const shortMatch = value.match(/(\d+(?:\.\d+)?(?:px|rem|em|%)?)(?:\/([^\s]+))?\s+(.+)$/);
        if (shortMatch) {
            info.size ??= shortMatch[1];
            info.lineHeight ??= shortMatch[2];
            info.family ??= shortMatch[3].trim();
        }

        const weightMatch = value.match(/\b([1-9]00|normal|bold|lighter|bolder)\b/i);
        if (weightMatch) {
            info.weight ??= weightMatch[1];
        }

        return info;
    }

    private esc(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
