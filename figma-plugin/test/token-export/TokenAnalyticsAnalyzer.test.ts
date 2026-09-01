import { describe, expect, it } from "vitest";
import { TokenAnalyticsAnalyzer } from "#/figma-plugin/token-export/TokenAnalyticsAnalyzer";
import type { TokenArchitectureCheckResult } from "#/figma-plugin/token-export/TokenArchitectureAnalyzer";
import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";

describe("TokenAnalyticsAnalyzer", () => {
    it("summarizes layers, references, theme files, and architecture states", () => {
        const analytics = new TokenAnalyticsAnalyzer().analyze(
            [
                tokenFile("tokens.json", {
                    primitive: {
                        color: {
                            blue: token("color", "#0000ff"),
                        },
                    },
                    semantic: {
                        color: {
                            action: token("color", "{primitive.color.blue}"),
                        },
                    },
                    component: {
                        button: {
                            background: token("color", "{semantic.color.action}"),
                        },
                    },
                    legacy: {
                        color: {
                            accent: token("color", "#ff00ff"),
                        },
                    },
                }),
                tokenFile("tokens.dark.json", {
                    semantic: {
                        color: {
                            action: token("color", "{primitive.color.blue}"),
                        },
                    },
                }),
            ],
            [
                architectureCheck("ok"),
                architectureCheck("warning"),
                architectureCheck("error"),
            ],
        );

        expect(analytics).toEqual({
            totalTokens: 5,
            themeFiles: 1,
            primitiveTokens: 1,
            semanticTokens: 2,
            componentTokens: 1,
            otherTokens: 1,
            referenceTokens: 3,
            rawValueTokens: 2,
            architectureOkChecks: 1,
            architectureWarningChecks: 1,
            architectureErrorChecks: 1,
        });
    });

    it("counts mixed composite tokens as both references and raw values", () => {
        const analytics = new TokenAnalyticsAnalyzer().analyze(
            [
                tokenFile("tokens.json", {
                    primitive: {
                        font: {
                            size: {
                                md: token("dimension", { value: 16, unit: "px" }),
                            },
                        },
                    },
                    semantic: {
                        typography: {
                            body: token("typography", {
                                fontFamily: "Inter",
                                fontSize: "{primitive.font.size.md}",
                                fontWeight: 400,
                                letterSpacing: { value: 0, unit: "px" },
                                lineHeight: 1.5,
                            }),
                        },
                    },
                }),
            ],
            [],
        );

        expect(analytics.referenceTokens).toBe(1);
        expect(analytics.rawValueTokens).toBe(2);
    });
});

function token(type: string, value: unknown): Record<string, unknown> {
    return {
        $type: type,
        $value: value,
    };
}

function tokenFile(fileName: string, tokens: Record<string, unknown>): ExportedTokenFile {
    return {
        fileName,
        content: JSON.stringify(tokens),
        tokens,
        downloadable: true,
        architectureWarnings: [],
    };
}

function architectureCheck(severity: TokenArchitectureCheckResult["severity"]): TokenArchitectureCheckResult {
    return {
        name: severity,
        description: severity,
        docsUrl: "https://design-token-kit.github.io/docs/guides/figma-plugin/",
        passed: severity === "ok",
        severity,
        issues: [],
        notes: [],
    };
}
