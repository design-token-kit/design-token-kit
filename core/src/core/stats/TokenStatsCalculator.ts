import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import type { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import type { TokenType } from "#/core/model/TokenType";

/** A single item in a breakdown sub-list. */
export type TokenStatBreakdownItem = {
    label: string;
    value?: number;
    percentage?: number;
};

export type TokenStatBreakdown = {
    label: string;
    items: readonly TokenStatBreakdownItem[];
};

export type TokenStat = {
    label: string;
    value: number;
    percentage?: number;
    description?: string;
    breakdowns?: readonly TokenStatBreakdown[];
};

/**
 * Computes stats from a parsed DTCG document list.
 */
export class TokenStatsCalculator {
    calculate(list: DtcgList): TokenStat[] {
        const totalTokens = this.countTotalTokens(list.base);
        const themeListBreakdown = this.collectThemes(list);
        const tokensByThemeBreakdown  = [...list.themes.entries()].map(([name, document]) => ({
            label: name,
            value: this.countTotalTokens(document),
            percentage: totalTokens === 0 ? 0 : (this.countTotalTokens(document) / totalTokens) * 100,
        }));
        const tokensByNamespaceBreakdown = this.countTokensByNamespace(list.base, totalTokens);
        const primitiveTokensByTypeBreakdown = this.countPrimitiveTokensByType(list.base);
        const referencedTokens = this.countReferencedTokens(list.base);
        const directValueTokens = this.countDirectValueTokens(list.base);

        return [
            {
                label: "Total tokens",
                value: totalTokens,
                description: "Counts all token nodes, including aliases and $root tokens. Groups are excluded.",
                breakdowns: [
                    ...(tokensByNamespaceBreakdown.length > 0 ? [{
                        label: "Tokens by namespace",
                        items: tokensByNamespaceBreakdown
                    }] : []),
                    ...(primitiveTokensByTypeBreakdown.length > 0 ? [{
                        label: "Primitive tokens by type",
                        items: primitiveTokensByTypeBreakdown
                    }] : []),
                    ...(themeListBreakdown.items.length > 0 ? [themeListBreakdown] : []),
                    ...(tokensByThemeBreakdown .length > 0 ? [{ label: "Tokens by theme", items: tokensByThemeBreakdown  }] : []),
                ],
            },
            {
                label: "Referenced tokens",
                value: referencedTokens,
                percentage: totalTokens === 0 ? 0 : (referencedTokens / totalTokens) * 100,
                description: "Counts token nodes whose value is a token reference.",
            },
            {
                label: "Direct values",
                value: directValueTokens,
                percentage: totalTokens === 0 ? 0 : (directValueTokens / totalTokens) * 100,
                description: "Counts token nodes with a direct literal or object value.",
            },
        ];
    }

    countTokensByNamespace(document: Dtcg, totalTokens?: number): TokenStatBreakdownItem[] {
        const breakdown: TokenStatBreakdownItem[] = [];

        for (const [name, node] of document.entries()) {
            const value = this.#countTokensInNode(node);
            if (value > 0) {
                breakdown.push({
                    label: name,
                    value,
                    percentage: totalTokens === undefined || totalTokens === 0 ? undefined : (value / totalTokens) * 100,
                });
            }
        }

        return breakdown;
    }

    collectThemes(list: DtcgList): TokenStatBreakdown {
        return {
            label: `Themes ${list.themes.size + 1}`,
            items: [
                { label: "base" },
                ...[...list.themes.keys()].map((name) => ({ label: name })),
            ],
        };
    }

    countPrimitiveTokensByType(document: Dtcg): TokenStatBreakdownItem[] {
        const counts = new Map<TokenType | "unknown", number>();
        const primitive = document.get("primitive");

        if (primitive === undefined) {
            return [];
        }

        this.#collectTokenTypes(primitive, counts);

        const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
        return [...counts.entries()].map(([label, value]) => ({
            label,
            value,
            percentage: total === 0 ? 0 : (value / total) * 100,
        }));
    }

    countTotalTokens(document: Dtcg): number {
        let count = 0;
        for (const [, node] of document.entries()) {
            count += this.#countTokensInNode(node);
        }
        return count;
    }

    countReferencedTokens(document: Dtcg): number {
        let count = 0;
        for (const [, node] of document.entries()) {
            count += this.#countReferencedTokensInNode(node);
        }
        return count;
    }

    countDirectValueTokens(document: Dtcg): number {
        let count = 0;
        for (const [, node] of document.entries()) {
            count += this.#countDirectValueTokensInNode(node);
        }
        return count;
    }

    #countTokensInNode(node: TokenGroup | TokenNode<unknown>): number {
        if (node instanceof TokenGroup) {
            let count = node.root !== undefined ? 1 : 0;
            for (const [, child] of node.entries()) {
                count += this.#countTokensInNode(child);
            }
            return count;
        }

        return 1;
    }

    #countReferencedTokensInNode(node: TokenGroup | TokenNode<unknown>): number {
        if (node instanceof TokenGroup) {
            let count = node.root !== undefined ? this.#isReferenceToken(node.root) : 0;
            for (const [, child] of node.entries()) {
                count += this.#countReferencedTokensInNode(child);
            }
            return count;
        }

        return this.#isReferenceToken(node);
    }

    #countDirectValueTokensInNode(node: TokenGroup | TokenNode<unknown>): number {
        if (node instanceof TokenGroup) {
            let count = node.root !== undefined ? this.#isDirectValueToken(node.root) : 0;
            for (const [, child] of node.entries()) {
                count += this.#countDirectValueTokensInNode(child);
            }
            return count;
        }

        return this.#isDirectValueToken(node);
    }

    #collectTokenTypes(node: TokenGroup | TokenNode<unknown>, counts: Map<TokenType | "unknown", number>): void {
        if (node instanceof TokenGroup) {
            if (node.root !== undefined) {
                this.#addTokenType(node.root, counts);
            }

            for (const [, child] of node.entries()) {
                this.#collectTokenTypes(child, counts);
            }
            return;
        }

        this.#addTokenType(node, counts);
    }

    #addTokenType(node: TokenNode<unknown>, counts: Map<TokenType | "unknown", number>): void {
        const type = node.type ?? "unknown";
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    #isReferenceToken(node: TokenNode<unknown>): number {
        return node.value instanceof TokenReference ? 1 : 0;
    }

    #isDirectValueToken(node: TokenNode<unknown>): number {
        return node.value instanceof TokenReference ? 0 : 1;
    }
}
