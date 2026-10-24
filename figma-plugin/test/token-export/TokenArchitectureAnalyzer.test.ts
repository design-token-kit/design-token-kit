import { describe, expect, it } from "vitest";
import { TokenArchitectureAnalyzer } from "#/figma-plugin/token-export/TokenArchitectureAnalyzer";
import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";

describe("TokenArchitectureAnalyzer", () => {
    it("accepts primitive, semantic, and component tokens with adjacent references", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
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
        })]);

        expect(report.warnings).toEqual([]);
        expect(report.checks.every((check) => check.passed)).toBe(true);
        expect(report.checks.map((check) => check.name)).toEqual([
            "Architecture layers are defined",
            "References follow the layer order",
            "Raw values stay in primitive tokens",
            "No broken token references",
            "Component tokens stay independent",
        ]);
        expect(report.checks.map((check) => check.description)).toEqual([
            "Detected layers: primitive, semantic, component.",
            "semantic -> primitive, component -> semantic",
            "Semantic and component tokens should use references.",
            "Every token reference points to an existing token.",
            "Components should reference semantic tokens, not other components.",
        ]);
        expect(report.checks.map((check) => check.docsUrl)).toEqual([
            "https://design-token-kit.github.io/docs/guides/figma-plugin/#three-token-levels",
            "https://design-token-kit.github.io/docs/guides/figma-plugin/#reference-rule",
            "https://design-token-kit.github.io/docs/guides/figma-plugin/#primitive",
            "https://design-token-kit.github.io/docs/guides/figma-plugin/#aliases",
            "https://design-token-kit.github.io/docs/guides/figma-plugin/#reference-rule",
        ]);
    });

    it("accepts token documents with only some architecture layers", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive: {
                color: {
                    blue: token("color", "#0000ff"),
                },
            },
        })]);

        expect(report.warnings).toEqual([]);
        expect(report.checks[0]?.severity).toBe("ok");
        expect(report.checks[0]?.description).toBe("Detected layers: primitive.");
    });

    it("reports raw values outside primitive tokens", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive: {
                color: {
                    blue: token("color", "#0000ff"),
                },
            },
            semantic: {
                color: {
                    action: token("color", "#0000ff"),
                },
            },
            component: {
                button: {
                    background: token("color", "#0000ff"),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.action\" and 1 more tokens use raw values outside primitive tokens.",
        ]);
        expect(report.checks[2]?.severity).toBe("warning");
    });

    it("reports raw fields inside composite tokens outside primitive", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
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
        })]);

        expect(report.warnings).toContain(
            "Token architecture: \"semantic.typography.body\" uses a raw value outside primitive tokens.",
        );
        expect(report.checks[2]?.severity).toBe("warning");
    });

    it("reports layer aliases as architecture warnings", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile(
            {
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
            },
            ["Components/Button/Background uses architecture layer alias \"components\"; prefer canonical layer \"component\"."],
        )]);

        expect(report.warnings).toEqual([
            "Token architecture: \"Components/Button/Background\" uses the alias \"components\".",
        ]);
        expect(report.checks[0]?.severity).toBe("warning");
        expect(report.checks[0]?.issueHeading).toBe("Prefer the canonical layer name \"component\".");
        expect(report.checks[0]?.issues).toEqual([
            "\"Components/Button/Background\" uses the alias \"components\".",
        ]);
    });

    it("summarizes repeated layer alias warnings", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile(
            {
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
                        text: token("color", "{semantic.color.action}"),
                    },
                },
            },
            [
                "Components/Button/Background uses architecture layer alias \"components\"; "
                    + "prefer canonical layer \"component\".",
                "Components/Button/Text uses architecture layer alias \"components\"; "
                    + "prefer canonical layer \"component\".",
            ],
        )]);

        expect(report.checks[0]?.issues).toEqual([
            "\"Components/Button/Background\" and 1 more tokens use the alias \"components\".",
        ]);
        expect(report.checks[0]?.issueHeading).toBe("Prefer the canonical layer name \"component\".");
    });

    it("reports missing token references", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive: {
                color: {
                    blue: token("color", "#0000ff"),
                },
            },
            semantic: {
                color: {
                    action: token("color", "{primitive.color.missing}"),
                },
            },
            component: {
                button: {
                    background: token("color", "{semantic.color.action}"),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.action\" references a missing token.",
        ]);
        expect(report.checks[3]?.severity).toBe("error");
    });

    it("reports cross-layer reference violations", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive: {
                color: {
                    blue: token("color", "{semantic.color.action}"),
                },
            },
            semantic: {
                color: {
                    action: token("color", "{semantic.color.accent}"),
                    accent: token("color", "#0000ff"),
                },
            },
            component: {
                button: {
                    background: token("color", "{primitive.color.blue}"),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"primitive.color.blue\" and 2 more tokens reference tokens outside the allowed layer order.",
            "Token architecture: \"semantic.color.accent\" uses a raw value outside primitive tokens.",
        ]);
        expect(report.checks[1]?.severity).toBe("warning");
        expect(report.checks[1]?.issueHeading).toBe(
            "Use references only in this order: semantic -> primitive, component -> semantic.",
        );
        expect(report.checks[2]?.issueHeading).toBe(
            "Move raw values to primitive tokens and reference them from semantic or component tokens.",
        );
    });

    it("reports component tokens that reference another component", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
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
                    background: token("color", "{component.card.background}"),
                },
                card: {
                    background: token("color", "{semantic.color.action}"),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"component.button.background\" references a token outside the allowed layer order.",
            "Token architecture: \"component.button.background\" references another component token.",
        ]);
        expect(report.checks[4]?.severity).toBe("warning");
        expect(report.checks[4]?.issueHeading).toBe("Reference semantic tokens from component tokens.");
    });
});

describe("TokenArchitectureAnalyzer property references", () => {
    const primitive = {
        color: {
            blue: token("color", { colorSpace: "srgb", components: [0, 0, 1], alpha: 1 }),
        },
        opacity: {
            disabled: token("number", 0.6),
        },
    };
    const blueWithDisabledOpacity = {
        colorSpace: { $ref: "#/primitive/color/blue/$value/colorSpace" },
        components: { $ref: "#/primitive/color/blue/$value/components" },
        alpha: { $ref: "#/primitive/opacity/disabled/$value" },
    };

    it("accepts semantic property references to primitive tokens", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            semantic: {
                color: {
                    disabled: token("color", blueWithDisabledOpacity),
                },
            },
        })]);

        expect(report.warnings).toEqual([]);
    });

    it("reports component property references that skip the semantic layer", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            component: {
                card: {
                    disabled: token("color", blueWithDisabledOpacity),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"component.card.disabled\" references a token outside the allowed layer order.",
        ]);
    });

    it("checks layers against the Figma alias targets of property references", () => {
        const report = new TokenArchitectureAnalyzer().analyze([{
            ...tokenFile({
                primitive,
                semantic: {
                    color: {
                        action: token("color", "{primitive.color.blue}"),
                    },
                    opacity: {
                        disabled: token("number", "{primitive.opacity.disabled}"),
                    },
                },
                component: {
                    card: {
                        disabled: token("color", blueWithDisabledOpacity),
                    },
                },
            }),
            referenceSources: {
                "component.card.disabled": {
                    "#/primitive/color/blue/$value/colorSpace": ["semantic", "color", "action"],
                    "#/primitive/color/blue/$value/components": ["semantic", "color", "action"],
                    "#/primitive/opacity/disabled/$value": ["semantic", "opacity", "disabled"],
                },
            },
        }]);

        expect(report.warnings).toEqual([]);
    });

    it("reports broken property references", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            semantic: {
                color: {
                    disabled: token("color", {
                        ...blueWithDisabledOpacity,
                        alpha: { $ref: "#/primitive/opacity/missing/$value" },
                    }),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.disabled\" references a missing token.",
        ]);
    });

    it("reports property references to missing value properties", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            semantic: {
                color: {
                    disabled: token("color", {
                        ...blueWithDisabledOpacity,
                        alpha: { $ref: "#/primitive/color/blue/$value/hex" },
                    }),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.disabled\" references a missing token.",
        ]);
    });

    it("treats objects with extra keys next to $ref as raw values", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            semantic: {
                color: {
                    disabled: token("color", {
                        ...blueWithDisabledOpacity,
                        alpha: { $ref: "#/primitive/opacity/disabled/$value", fallback: 0.5 },
                    }),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.disabled\" uses a raw value outside primitive tokens.",
        ]);
    });

    it("ignores Figma alias targets that are missing from the document", () => {
        const report = new TokenArchitectureAnalyzer().analyze([{
            ...tokenFile({
                primitive,
                component: {
                    card: {
                        disabled: token("color", blueWithDisabledOpacity),
                    },
                },
            }),
            referenceSources: {
                "component.card.disabled": {
                    "#/primitive/color/blue/$value/colorSpace": ["semantic", "color", "action"],
                    "#/primitive/color/blue/$value/components": ["semantic", "color", "action"],
                    "#/primitive/opacity/disabled/$value": ["semantic", "opacity", "disabled"],
                },
            },
        }]);

        expect(report.warnings).toEqual([
            "Token architecture: \"component.card.disabled\" references a token outside the allowed layer order.",
        ]);
    });

    it("reports malformed property reference pointers as missing tokens", () => {
        const report = new TokenArchitectureAnalyzer().analyze([tokenFile({
            primitive,
            semantic: {
                color: {
                    disabled: token("color", {
                        ...blueWithDisabledOpacity,
                        alpha: { $ref: "#/primitive/opacity/50%/$value" },
                    }),
                },
            },
        })]);

        expect(report.warnings).toEqual([
            "Token architecture: \"semantic.color.disabled\" references a missing token.",
        ]);
    });
});

function token(type: string, value: unknown): Record<string, unknown> {
    return {
        $type: type,
        $value: value,
    };
}

function tokenFile(tokens: Record<string, unknown>, architectureWarnings: string[] = []): ExportedTokenFile {
    return {
        fileName: "tokens.json",
        content: JSON.stringify(tokens),
        tokens,
        downloadable: true,
        architectureWarnings,
    };
}
