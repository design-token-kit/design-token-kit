import { describe, expect, it } from "vitest";
import { DtcgReader } from "@design-token-kit/core/core/formats/dtcg/DtcgReader";
import { DtcgList } from "@design-token-kit/core/core/model/DtcgList";
import { TokenCheckAnalyzer } from "#/figma-plugin/token-export/TokenCheckAnalyzer";

describe("TokenCheckAnalyzer", () => {
    it("runs core checks and keeps plugin architecture warnings separate", () => {
        const document = read({
            primitive: {
                color: {
                    blue: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1 },
                    },
                },
            },
            semantic: {
                color: {
                    action: { $type: "color", $value: "{primitive.color.blue}" },
                },
            },
            component: {
                button: {
                    background: {
                        $type: "color",
                        $value: {
                            colorSpace: { $ref: "#/primitive/color/blue/$value/colorSpace" },
                            components: [0, 0, 1],
                            alpha: 1,
                        },
                        $extensions: {
                            "io.github.design-token-kit": {
                                referenceSources: {
                                    "#/primitive/color/blue/$value/colorSpace": "{semantic.color.action}",
                                },
                            },
                        },
                    },
                },
            },
        });

        const report = new TokenCheckAnalyzer().analyze(
            new DtcgList(document),
            [],
            ["Uses a legacy layer alias."],
        );

        expect(report.checks.find((check) => check.name === "References follow the layer order")).toMatchObject({
            passed: true,
            severity: "ok",
        });
        expect(report.warnings).toEqual(["Uses a legacy layer alias."]);
    });

    it("shows reader failures in their own card", () => {
        const report = new TokenCheckAnalyzer().analyze(undefined, [{
            id: "json-syntax",
            sourcePath: "tokens.json",
            message: "invalid JSON",
            severity: "error",
        }]);

        expect(report.checks[0]).toMatchObject({
            name: "Token data could not be checked",
            passed: false,
            severity: "error",
            description: "The plugin could not read the generated token data.",
            issues: ["tokens.json: invalid JSON"],
            issueDetails: ["tokens.json: invalid JSON"],
        });
    });

    it("shows an explicit empty state when no token data is available", () => {
        const report = new TokenCheckAnalyzer().analyze(undefined, []);

        expect(report.checks).toEqual([{
            name: "No tokens found",
            description: "Add local Variables or Styles in Figma to run token checks.",
            docsUrl: "",
            passed: false,
            severity: "info",
            issues: [],
            issueDetails: [],
            notes: [],
            state: "empty",
        }]);
    });

    it("uses rule descriptions for passed cards and problem descriptions for failed cards", () => {
        const report = new TokenCheckAnalyzer().analyze(new DtcgList(read({
            "$extensions": { "design-token-kit": { remBase: 0 } },
            primitive: {
                color: {
                    blue: { "$type": "color", "$value": { colorSpace: "srgb", components: [0, 0, 1] } },
                },
                size: {
                    small: { "$type": "dimension", "$value": { value: 4, unit: "px" } },
                },
            },
            semantic: {
                raw: { "$type": "color", "$value": { colorSpace: "srgb", components: [1, 0, 0] } },
                mismatch: { "$type": "color", "$value": "{primitive.size.small}" },
                broken: { "$type": "color", "$value": "{primitive.missing}" },
                gradient: {
                    "$type": "gradient",
                    "$value": [
                        { color: { colorSpace: "srgb", components: [0, 0, 0] }, position: 0 },
                        { color: { colorSpace: "srgb", components: [1, 1, 1] }, position: 0 },
                    ],
                },
                empty: {},
                undocumented: { "$type": "color", "$value": { colorSpace: "srgb", components: [0, 1, 0] } },
            },
            component: {
                base: { "$type": "color", "$value": "{semantic.raw}" },
                nested: { "$type": "color", "$value": "{component.base}" },
            },
            legacy: {
                value: {
                    "$type": "dimension",
                    "$value": { value: 10, unit: "px" },
                    "$extensions": { "design-token-kit": { tailwindNamespace: "spacing" } },
                },
            },
        })), [], [], true);

        const expectedFailures = [
            ["Raw values outside primitive", "Semantic and component tokens contain raw values instead of references."],
            ["Token reference issues", "Some references are missing, circular, point to groups, or use deprecated tokens."],
            ["Component-to-component references", "Component tokens reference other component tokens."],
            ["Tokens outside required layers", "Some tokens are outside the primitive, semantic, or component layers."],
            ["Token type mismatch", "An alias points to a token with a different type."],
            ["Duplicate gradient stops", "A gradient uses the same stop position more than once."],
            ["Empty token groups", "Some groups contain no tokens or child groups."],
            ["Missing token descriptions", "Some tokens have no description."],
            ["Unsupported Tailwind namespace", "Some tokens use unsupported Tailwind namespace values."],
            ["Invalid rem base", "The rem base must be a positive number."],
        ] as const;

        for (const [name, description] of expectedFailures) {
            expect(report.checks.find((check) => check.name === name)).toMatchObject({
                passed: false,
                description,
            });
        }
        const cleanReport = new TokenCheckAnalyzer().analyze(new DtcgList(read({
            primitive: {
                color: {
                    blue: {
                        "$type": "color",
                        "$description": "Blue",
                        "$value": { colorSpace: "srgb", components: [0, 0, 1] },
                    },
                },
            },
            semantic: {
                color: {
                    action: {
                        "$type": "color",
                        "$description": "Action",
                        "$value": "{primitive.color.blue}",
                    },
                },
            },
        })), [], [], true);

        expect(cleanReport.checks.find((check) => check.name === "Raw values stay in primitive tokens")).toMatchObject({
            passed: true,
            description: "Semantic and component tokens should use references.",
        });
    });

    it("keeps optional lint checks behind the full linting option", () => {
        const document = read({
            primitive: {
                color: {
                    blue: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1 },
                    },
                },
            },
        });

        const compatibilityReport = new TokenCheckAnalyzer().analyze(new DtcgList(document), []);
        const fullReport = new TokenCheckAnalyzer().analyze(new DtcgList(document), [], [], true);

        expect(compatibilityReport.checks.some((check) => check.name.includes("description"))).toBe(false);
        expect(fullReport.checks.find((check) => check.name === "Missing token descriptions")).toMatchObject({
            severity: "warning",
            passed: false,
        });
    });

    it("keeps layer alias warnings on the architecture card", () => {
        const report = new TokenCheckAnalyzer().analyze(undefined, [], [
            "components/button/background uses architecture layer alias \"components\"; prefer canonical layer \"component\".",
            "components/button/label uses architecture layer alias \"components\"; prefer canonical layer \"component\".",
        ]);

         expect(report.checks.find((check) => check.name === "Non-standard layer names")).toMatchObject({
             passed: false,
             severity: "warning",
             description: "The layer name \"components\" is supported, but \"component\" is recommended.",
              issueHeading: "Rename the “components” group to “component”.",
              notes: [],
              issues: ["\"components/button/background\" and 1 more tokens use the alias \"components\"."],
              issueDetails: [
                  "\"components/button/background\" uses the alias \"components\".",
                  "\"components/button/label\" uses the alias \"components\".",
              ],
         });
        expect(report.warnings).toEqual([]);
    });

    it("names tokens without a root layer separately from layer aliases", () => {
        const document = read({
            color: {
                red: { $type: "color", $value: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 } },
            },
        });

        const report = new TokenCheckAnalyzer().analyze(new DtcgList(document), []);

        expect(report.checks.find((check) => check.name === "Tokens outside required layers")).toMatchObject({
            passed: false,
            severity: "warning",
        });
    });

    it("reports component-to-component references only on the component card", () => {
        const document = read({
            primitive: {
                color: {
                    blue: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1 } },
                },
            },
            semantic: {
                color: {
                    action: { $type: "color", $value: "{primitive.color.blue}" },
                },
            },
            component: {
                button: {
                    background: { $type: "color", $value: "{semantic.color.action}" },
                },
                link: {
                    background: { $type: "color", $value: "{component.button.background}" },
                },
            },
        });

        const report = new TokenCheckAnalyzer().analyze(new DtcgList(document), [], [], true);

        expect(report.checks.find((check) => check.name === "References follow the layer order")).toMatchObject({
            passed: true,
        });
        expect(report.checks.find((check) => check.name === "Component-to-component references")).toMatchObject({
            passed: false,
            severity: "error",
        });
    });

    it("keeps legacy architecture severity without full linting", () => {
        const document = read({
            primitive: {
                color: {
                    periwinkle: {
                        $type: "color",
                        $value: { colorSpace: "srgb", components: [0.5, 0.5, 1], alpha: 1 },
                    },
                    brand: { $type: "color", $value: "{primitive.color.periwinkle}" },
                },
            },
        });

        const compatibilityReport = new TokenCheckAnalyzer().analyze(new DtcgList(document), []);
        const fullReport = new TokenCheckAnalyzer().analyze(new DtcgList(document), [], [], true);

        expect(compatibilityReport.checks.find((check) => check.name === "Invalid layer references"))
            .toMatchObject({
                severity: "warning",
                passed: false,
                description: "Semantic tokens must reference primitives, and component tokens must reference semantics. References within the same layer are not allowed.",
            });
        expect(fullReport.checks.find((check) => check.name === "Invalid layer references"))
            .toMatchObject({ severity: "error", passed: false });
    });
});

function read(tokens: Record<string, unknown>) {
    const result = DtcgReader.noSchema().read(JSON.stringify(tokens), "tokens.json");
    if (!result.ok) {
        throw new Error(result.issues.map((issue) => issue.message).join("\n"));
    }
    return result.documents[0]!;
}
