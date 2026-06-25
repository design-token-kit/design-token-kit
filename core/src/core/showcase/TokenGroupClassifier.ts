import {
    ScopedTokenEntry,
    ThemeBucket,
    TokenEntry,
} from "#/core/showcase/CssTokenParser";

/**
 * Groups tokens for display in the HTML showcase.
 *
 * @remarks
 * Sorts tokens by scope: `primitive`, `semantic`, `component`,
 * separates primitive themes and sorts groups in a stable order.
 *
 * For visual sections uses simple heuristics by name and value
 * of CSS variable: colors, typography, spacing, shadows, motion and others.
 */
export class TokenGroupClassifier {
    static readonly #COLOR_HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

    groupEntriesByScope(entries: ScopedTokenEntry[]): Map<string, TokenEntry[]> {
        const scopes = new Map<string, TokenEntry[]>();

        for (const entry of entries) {
            if (!scopes.has(entry.scope)) {
                scopes.set(entry.scope, []);
            }
            scopes.get(entry.scope)!.push({ name: entry.name, value: entry.value });
        }

        return scopes;
    }

    getPrimitiveThemes(themes: ThemeBucket[]): ThemeBucket[] {
        return themes
            .map((theme) => ({
                name: theme.name,
                entries: theme.entries.filter((entry) => entry.scope === "primitive"),
            }))
            .filter((theme) => theme.entries.length > 0);
    }

    getOrderedScopes(
        scopes: Map<string, TokenEntry[]>,
    ): Array<[string, TokenEntry[]]> {
        const priority = new Map<string, number>([
            ["primitive", 0],
            ["semantic", 1],
            ["component", 2],
        ]);

        return [...scopes.entries()].sort(([left], [right]) => {
            const leftPriority = priority.get(left) ?? 99;
            const rightPriority = priority.get(right) ?? 99;
            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }
            return left.localeCompare(right);
        });
    }

    groupTokens(tokens: TokenEntry[]): Map<string, TokenEntry[]> {
        const grouped = new Map<string, TokenEntry[]>();
        const order = [
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
        ];

        for (const group of order) {
            grouped.set(group, []);
        }

        for (const token of tokens) {
            const group = this.classifyTokenGroup(token.name, token.value);
            grouped.get(group)!.push(token);
        }

        const result = new Map<string, TokenEntry[]>();
        for (const group of order) {
            const groupTokens = grouped.get(group)!;
            if (groupTokens.length > 0) {
                result.set(group, groupTokens);
            }
        }

        return result;
    }

    private classifyTokenGroup(name: string, value: string): string {
        const lowerName = name.toLowerCase();
        const lowerValue = value.toLowerCase();

        if (
            lowerName.includes("typography")
            || lowerValue.includes("typography")
            || lowerName.includes("-text-")
            || lowerName.includes("-body-")
            || lowerName.includes("-title-")
            || lowerName.includes("-code-")
        ) {
            return "typography";
        }

        if (
            lowerName.includes("font-family")
            || lowerName.includes("font-size")
            || lowerName.includes("font-weight")
            || lowerName.includes("line-height")
            || lowerName.includes("lineheight")
            || lowerName.includes("letter-spacing")
            || lowerName.includes("tracking")
        ) {
            return "fonts";
        }

        if (lowerName.includes("border") || lowerName.includes("stroke") || lowerName.includes("outline")) {
            return "borders";
        }

        if (lowerName.includes("shadow") || lowerName.includes("elevation")) {
            return "shadows";
        }

        if (lowerName.includes("gradient")) {
            return "gradients";
        }

        if (
            lowerName.includes("color")
            || TokenGroupClassifier.#COLOR_HEX_RE.test(value)
            || lowerValue.startsWith("rgb")
            || lowerValue.startsWith("hsl")
        ) {
            return "colors";
        }

        if (lowerName.includes("radius") || lowerName.includes("rounded")) {
            return "radius";
        }

        if (
            lowerName.includes("space")
            || lowerName.includes("spacing")
            || lowerName.includes("gap")
            || lowerName.includes("padding")
            || lowerName.includes("margin")
            || lowerName.includes("inset")
        ) {
            return "spacing";
        }

        if (
            lowerName.includes("duration")
            || lowerName.includes("easing")
            || lowerName.includes("cubic-bezier")
            || lowerName.includes("transition")
            || lowerName.includes("animation")
            || lowerValue.includes("cubic-bezier")
            || lowerValue.includes("ms")
            || lowerValue.endsWith("s")
        ) {
            return "motion";
        }

        if (lowerName.includes("opacity") || lowerName.includes("alpha")) {
            return "opacity";
        }

        if (lowerName.includes("size") || lowerName.includes("width") || lowerName.includes("height")) {
            return "sizes";
        }

        return "other";
    }
}
