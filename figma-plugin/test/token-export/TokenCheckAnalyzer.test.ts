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
            name: "Token files are readable",
            passed: false,
            severity: "error",
            issues: ["tokens.json: invalid JSON"],
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

        expect(report.checks.find((check) => check.name === "Non-canonical layer names")).toMatchObject({
            passed: false,
            severity: "warning",
            description: "Non-canonical layer name “components” detected. Consider renaming it to “component” for consistency.",
            issueHeading: "Rename the “components” group to “component”.",
            notes: [],
            issues: ["\"components/button/background\" and 1 more tokens use the alias \"components\"."],
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

        expect(report.checks.find((check) => check.name === "Tokens outside architecture layers")).toMatchObject({
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
        expect(report.checks.find((check) => check.name === "Component tokens stay independent")).toMatchObject({
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
            .toMatchObject({ severity: "warning", passed: false });
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
