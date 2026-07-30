/**
 * Token counts displayed in the Figma plugin UI.
 */
export interface TokenCounts {
    colorTokens: number;
    dimensionTokens: number;
    numberTokens: number;
    typographyTokens: number;
    shadowTokens: number;
}

/**
 * Counts DTCG token types in a nested token document.
 */
export class TokenCounter {

    count(value: unknown): TokenCounts {
        if (!isRecord(value)) {
            return this.empty();
        }

        if ("$type" in value && "$value" in value) {
            return this.#countSingleToken(value.$type);
        }

        return Object.values(value).reduce<TokenCounts>(
            (counts, child) => this.add(counts, this.count(child)),
            this.empty(),
        );
    }

    empty(): TokenCounts {
        return {
            colorTokens: 0,
            dimensionTokens: 0,
            numberTokens: 0,
            typographyTokens: 0,
            shadowTokens: 0,
        };
    }

    add(left: TokenCounts, right: TokenCounts): TokenCounts {
        return {
            colorTokens: left.colorTokens + right.colorTokens,
            dimensionTokens: left.dimensionTokens + right.dimensionTokens,
            numberTokens: left.numberTokens + right.numberTokens,
            typographyTokens: left.typographyTokens + right.typographyTokens,
            shadowTokens: left.shadowTokens + right.shadowTokens,
        };
    }

    #countSingleToken(tokenType: unknown): TokenCounts {
        return {
            colorTokens: tokenType === "color" ? 1 : 0,
            dimensionTokens: tokenType === "dimension" ? 1 : 0,
            numberTokens: tokenType === "number" ? 1 : 0,
            typographyTokens: tokenType === "typography" ? 1 : 0,
            shadowTokens: tokenType === "shadow" ? 1 : 0,
        };
    }

}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
