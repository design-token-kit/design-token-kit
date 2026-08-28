import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";
import type { TokenArchitectureCheckResult } from "#/figma-plugin/token-export/TokenArchitectureAnalyzer";

/**
 * Summarizes exported token files for the plugin UI.
 */
export class TokenAnalyticsAnalyzer {

    /**
     * Returns compact statistics for exported token files.
     */
    analyze(
        files: ExportedTokenFile[],
        architectureChecks: TokenArchitectureCheckResult[],
    ): TokenAnalyticsReport {
        const tokens = files.flatMap((file) => collectTokens(file.tokens));

        return {
            totalTokens: tokens.length,
            themeFiles: countThemeFiles(files),
            primitiveTokens: countTokensInLayer(tokens, "primitive"),
            semanticTokens: countTokensInLayer(tokens, "semantic"),
            componentTokens: countTokensInLayer(tokens, "component"),
            otherTokens: tokens.filter((token) => !isTokenLayer(token.path[0])).length,
            referenceTokens: tokens.filter((token) => hasReference(token.value)).length,
            rawValueTokens: tokens.filter((token) => !hasReference(token.value)).length,
            architectureOkChecks: architectureChecks.filter((check) => check.severity === "ok").length,
            architectureWarningChecks: architectureChecks.filter((check) => check.severity === "warning").length,
            architectureErrorChecks: architectureChecks.filter((check) => check.severity === "error").length,
        };
    }

}

/**
 * Compact token analytics shown above architecture checks.
 */
export interface TokenAnalyticsReport {
    totalTokens: number;
    themeFiles: number;
    primitiveTokens: number;
    semanticTokens: number;
    componentTokens: number;
    otherTokens: number;
    referenceTokens: number;
    rawValueTokens: number;
    architectureOkChecks: number;
    architectureWarningChecks: number;
    architectureErrorChecks: number;
}

const TOKEN_LAYERS = ["primitive", "semantic", "component"] as const;
const REFERENCE_PATTERN = /\{[^{}]+\}/;

type TokenLayer = typeof TOKEN_LAYERS[number];

interface TokenAnalyticsEntry {
    path: string[];
    value: unknown;
}

function collectTokens(value: unknown, path: string[] = []): TokenAnalyticsEntry[] {
    if (!isRecord(value)) {
        return [];
    }

    if ("$type" in value && "$value" in value) {
        return [{ path, value: value.$value }];
    }

    return Object.entries(value).flatMap(([key, child]) => collectTokens(child, [...path, key]));
}

function countThemeFiles(files: ExportedTokenFile[]): number {
    return files.filter((file) => /^tokens\..+\.json$/.test(file.fileName)).length;
}

function countTokensInLayer(tokens: TokenAnalyticsEntry[], layer: TokenLayer): number {
    return tokens.filter((token) => token.path[0] === layer).length;
}

function isTokenLayer(value: string | undefined): value is TokenLayer {
    return TOKEN_LAYERS.some((layer) => layer === value);
}

function hasReference(value: unknown): boolean {
    if (typeof value === "string") {
        return REFERENCE_PATTERN.test(value);
    }

    if (Array.isArray(value)) {
        return value.some(hasReference);
    }

    if (isRecord(value)) {
        return Object.values(value).some(hasReference);
    }

    return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
