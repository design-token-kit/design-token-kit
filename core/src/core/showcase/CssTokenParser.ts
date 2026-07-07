export type TokenEntry = { name: string; value: string };

export type ScopedTokenEntry = TokenEntry & {
    scope: string;
    themeName?: string;
};

export type ParsedTokenCss = {
    entries: ScopedTokenEntry[];
    themes: ThemeBucket[];
};

export type ThemeBucket = {
    name: string;
    entries: ScopedTokenEntry[];
};

/**
 * Parses generated CSS variables into a structure for the HTML showcase.
 *
 * @remarks
 * Finds `:root { ... }` blocks, extracts CSS custom properties from them
 * and keeps the link to themes from `Set` and `Modifier` comments.
 *
 * Returns:
 * - a full list of all found tokens;
 * - a list of tokens grouped by themes.
 */
export class CssTokenParser {
    parse(cssString: string): ParsedTokenCss {
        const entries: ScopedTokenEntry[] = [];
        const themeMap = new Map<string, ScopedTokenEntry[]>();
        let currentSet: string | undefined;
        let pendingThemeName: string | undefined;
        let currentThemeName: string | undefined;
        let insideBlock = false;
        let collectCurrentBlock = false;
        let sawTailwindThemeBlock = false;
        const blockLines: string[] = [];

        for (const line of cssString.split(/\r?\n/g)) {
            const trimmed = line.trim();

            if (!insideBlock && trimmed.startsWith("/* Set:")) {
                currentSet = trimmed
                    .replace("/* Set:", "")
                    .replace("*/", "")
                    .trim();
                pendingThemeName = currentSet;
                continue;
            }

            if (!insideBlock && trimmed.startsWith("/* Modifier:")) {
                const modifierName = this.extractModifierThemeName(trimmed);
                pendingThemeName = modifierName
                    ? (currentSet ? `${currentSet}.${modifierName}` : modifierName)
                    : undefined;
                continue;
            }

            if (!insideBlock && trimmed.endsWith("{")) {
                const selector = trimmed.slice(0, -1).trim();
                const selectorThemeName = this.extractSelectorThemeName(selector);

                if (selector === "@theme") {
                    sawTailwindThemeBlock = true;
                    insideBlock = true;
                    collectCurrentBlock = true;
                    currentThemeName = undefined;
                } else {
                    insideBlock = true;
                    currentThemeName = pendingThemeName ?? currentSet ?? selectorThemeName;
                    collectCurrentBlock = currentThemeName !== undefined || !sawTailwindThemeBlock && selector.startsWith(":root");
                }

                blockLines.length = 0;
                pendingThemeName = undefined;
                continue;
            }

            if (insideBlock) {
                if (trimmed === "}") {
                    insideBlock = false;
                    if (collectCurrentBlock) {
                        const blockEntries = this.extractBlockEntries(blockLines.join("\n"), currentThemeName);
                        entries.push(...blockEntries);

                        if (currentThemeName && blockEntries.length > 0) {
                            if (!themeMap.has(currentThemeName)) {
                                themeMap.set(currentThemeName, []);
                            }
                            themeMap.get(currentThemeName)!.push(...blockEntries);
                        }
                    }

                    currentThemeName = undefined;
                    collectCurrentBlock = false;
                    blockLines.length = 0;
                    continue;
                }

                if (collectCurrentBlock) {
                    blockLines.push(line);
                }
            }
        }

        const themes: ThemeBucket[] = [...themeMap.entries()].map(([name, themeEntries]) => ({
            name,
            entries: themeEntries,
        }));

        return { entries, themes };
    }

    private extractModifierThemeName(annotationValue: string): string | undefined {
        const match = annotationValue.match(/theme\s*=\s*([a-zA-Z0-9_-]+)/);
        return match?.[1];
    }

    private extractSelectorThemeName(selector: string): string | undefined {
        const match = selector.match(/\[(?:data-)?theme\s*=\s*["']?([a-zA-Z0-9_-]+)["']?\]/);
        return match?.[1];
    }

    private extractBlockEntries(body: string, themeName?: string): ScopedTokenEntry[] {
        const entries: ScopedTokenEntry[] = [];
        const tokenPattern = /--([^:]+):\s*([\s\S]*?);/g;

        for (const match of body.matchAll(tokenPattern)) {
            const name = `--${match[1]}`;
            const value = match[2].replace(/\s+/g, " ").trim();
            const scope = match[1].split("-")[0] || "other";
            entries.push({ name, value, scope, themeName });
        }

        return entries;
    }
}
