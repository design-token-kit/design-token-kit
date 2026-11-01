import { describe, expect, it } from "vitest";
import { TokenAuditor } from "#/core/audit/TokenAuditor";
import { TokenTextSampler } from "#/core/audit/tokens/TokenTextSampler";
import { readDtcgList } from "../../support/readDtcg";

function color(hex: string, alpha = 1): object {
    const value = hex.replace("#", "");
    const components = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    return { $type: "color", $value: { colorSpace: "srgb", components, alpha, hex } };
}

function alias(path: string): object {
    return { $value: `{${path}}` };
}

function typography(fontSize: number, lineHeight: number, fontWeight: number | string = 400): object {
    return {
        $type: "typography",
        $value: {
            fontFamily: ["Inter"],
            fontSize: { value: fontSize, unit: "px" },
            fontWeight,
            letterSpacing: { value: 0, unit: "px" },
            lineHeight,
        },
    };
}

const PRIMITIVES = {
    color: {
        white: color("#ffffff"),
        gray: { 400: color("#a1a4aa"), 900: color("#1a1a1a") },
        green: color("#10b981"),
        scrim: color("#000000", 0.5),
    },
};

function contrastIds(report: { findings: Array<{ id: string; subjectId: string }> }): string[] {
    return report.findings.filter((finding) => finding.id === "text-contrast").map((finding) => finding.subjectId);
}

describe("TokenTextSampler", () => {
    it("pairs text and background colors of the same group", async () => {
        const list = await readDtcgList({
            primitive: PRIMITIVES,
            semantic: {
                color: {
                    "text-primary": alias("primitive.color.gray.900"),
                    "text-inverse": alias("primitive.color.white"),
                    "background-canvas": alias("primitive.color.white"),
                    "background-inverse": alias("primitive.color.gray.900"),
                    "background-overlay": alias("primitive.color.scrim"),
                    "border-strong": alias("primitive.color.gray.400"),
                },
            },
        });

        expect(new TokenTextSampler().sample(list).map((sample) => sample.id)).toEqual([
            "semantic.color.text-primary|semantic.color.background-canvas",
            "semantic.color.text-inverse|semantic.color.background-inverse",
        ]);
    });

    it("pairs on-X colors with their background only", async () => {
        const list = await readDtcgList({
            color: {
                brand: color("#10b981"),
                "on-brand": color("#ffffff"),
                "background-page": color("#ffffff"),
            },
        });

        expect(new TokenTextSampler().sample(list).map((sample) => sample.id)).toEqual(["color.on-brand|color.brand"]);
    });

    it("takes the font size of a pair from the typography token of its group", async () => {
        const list = await readDtcgList({
            component: {
                badge: {
                    text: color("#ffffff"),
                    background: color("#10b981"),
                    typography: typography(24, 1.2),
                },
            },
        });

        const [pair, type] = new TokenTextSampler().sample(list);
        expect(pair).toMatchObject({ id: "component.badge.text|component.badge.background", fontSizePx: 24, fontWeight: 400 });
        expect(type).toMatchObject({ id: "component.badge.typography", fontSizePx: 24, lineHeight: 1.2 });
    });

    it("samples typography tokens with their own value and resolves their references", async () => {
        const list = await readDtcgList({
            primitive: {
                size: { small: { $type: "dimension", $value: { value: 0.625, unit: "rem" } } },
                leading: { tight: { $type: "number", $value: 1.1 } },
                weight: { bold: { $type: "fontWeight", $value: "bold" } },
                typography: {
                    caption: {
                        $type: "typography",
                        $value: {
                            fontFamily: ["Inter"],
                            fontSize: "{primitive.size.small}",
                            fontWeight: "{primitive.weight.bold}",
                            letterSpacing: { value: 0, unit: "px" },
                            lineHeight: "{primitive.leading.tight}",
                        },
                    },
                },
            },
            semantic: { text: { caption: alias("primitive.typography.caption") } },
        });

        expect(new TokenTextSampler().sample(list)).toEqual([expect.objectContaining({
            id: "primitive.typography.caption",
            fontSizePx: 10,
            fontWeight: 700,
            lineHeight: 1.1,
        })]);
    });

    it("reports for a theme only the samples it changes", async () => {
        const list = await readDtcgList(
            {
                primitive: PRIMITIVES,
                semantic: {
                    color: {
                        "text-primary": alias("primitive.color.gray.900"),
                        "text-secondary": alias("primitive.color.gray.400"),
                        "background-canvas": alias("primitive.color.white"),
                    },
                },
            },
            { dark: { primitive: { color: { white: color("#121212") } } } },
        );

        const samples = new TokenTextSampler().sample(list);
        expect(samples.map((sample) => [sample.theme ?? "base", sample.id])).toEqual([
            ["base", "semantic.color.text-primary|semantic.color.background-canvas"],
            ["base", "semantic.color.text-secondary|semantic.color.background-canvas"],
            ["dark", "semantic.color.text-primary|semantic.color.background-canvas"],
            ["dark", "semantic.color.text-secondary|semantic.color.background-canvas"],
        ]);
        expect(samples[2].background).toMatchObject({ red: 0x12 / 255 });
    });

    it("pairs text-on-X colors with the background named X", async () => {
        const list = await readDtcgList({
            color: {
                "background-brand": color("#10b981"),
                "text-on-brand": color("#ffffff"),
                "text-primary": color("#111111"),
                "background-page": color("#ffffff"),
            },
        });

        expect(new TokenTextSampler().sample(list).map((sample) => sample.id)).toEqual([
            "color.text-on-brand|color.background-brand",
            "color.text-primary|color.background-page",
        ]);
    });

    it("holds a pair to the smallest typography of its group", async () => {
        const list = await readDtcgList({
            component: {
                card: {
                    text: color("#777777"),
                    background: color("#ffffff"),
                    title: typography(28, 1.2, 700),
                    caption: typography(13, 1.5),
                },
            },
        });

        expect(new TokenTextSampler().sample(list)[0]).toMatchObject({ fontSizePx: 13, fontWeight: 400 });
    });

    it("converts rem font sizes with the declared rem base", async () => {
        const list = await readDtcgList({
            $extensions: { "design-token-kit": { remBase: 10 } },
            type: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: { value: 1.5, unit: "rem" },
                        fontWeight: 400,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });

        expect(new TokenTextSampler().sample(list)[0].fontSizePx).toBe(15);
    });

    it("reads typography fields given as property references", async () => {
        const list = await readDtcgList({
            primitive: {
                body: typography(16, 1.5),
                caption: {
                    $type: "typography",
                    $value: {
                        fontFamily: ["Inter"],
                        fontSize: { value: 10, unit: "px" },
                        fontWeight: 400,
                        letterSpacing: { value: 0, unit: "px" },
                        lineHeight: { $ref: "#/primitive/body/$value/lineHeight" },
                    },
                },
            },
        });

        const caption = new TokenTextSampler().sample(list).find((sample) => sample.id === "primitive.caption");
        expect(caption?.lineHeight).toBe(1.5);
    });

    it("samples tokens a theme adds", async () => {
        const list = await readDtcgList(
            { color: { "background-page": color("#ffffff") } },
            { dark: { color: { "text-hint": color("#eeeeee") } } },
        );

        expect(new TokenTextSampler().sample(list)).toEqual([expect.objectContaining({
            id: "color.text-hint|color.background-page",
            theme: "dark",
        })]);
    });

    it("explains colors it cannot read", async () => {
        const list = await readDtcgList({
            color: {
                text: { $type: "color", $value: { colorSpace: "rec2020", components: [0, 0, 0] } },
                background: color("#ffffff"),
            },
        });

        expect(new TokenTextSampler().sample(list)[0].colorProblem)
            .toBe("cannot read color.text: the rec2020 color space is not supported without a hex fallback");
    });
});

describe("TokenAuditor", () => {
    it("reports low contrast pairs, skips translucent and disabled ones, and scores the result", async () => {
        const list = await readDtcgList({
            primitive: PRIMITIVES,
            semantic: {
                color: {
                    "text-primary": alias("primitive.color.gray.900"),
                    "text-tertiary": alias("primitive.color.gray.400"),
                    "text-disabled": alias("primitive.color.gray.400"),
                    "background-canvas": alias("primitive.color.white"),
                    "background-glass": alias("primitive.color.scrim"),
                },
            },
            component: {
                badge: { text: alias("primitive.color.white"), background: alias("primitive.color.green") },
            },
        });

        const report = new TokenAuditor().auditList(list);

        expect(contrastIds(report)).toEqual([
            "semantic.color.text-tertiary|semantic.color.background-canvas",
            "component.badge.text|component.badge.background",
        ]);
        expect(report.unchecked.map((subject) => subject.subjectId)).toEqual([
            "semantic.color.text-primary|semantic.color.background-glass",
            "semantic.color.text-tertiary|semantic.color.background-glass",
        ]);
        expect(report.sampleCount).toBe(5);
        expect(report.score).toEqual({ score: 96, grade: "A" });
    });

    it("audits against AAA and scores with the given weights", async () => {
        const list = await readDtcgList({
            color: { text: color("#707070"), background: color("#ffffff") },
        });

        const report = new TokenAuditor({ level: "AAA", scoreWeights: { warning: 10 } }).auditList(list);

        expect(report.findings).toEqual([expect.objectContaining({ id: "text-contrast", severity: "warning", measurement: "4.95:1" })]);
        expect(report.score).toEqual({ score: 90, grade: "A" });
    });

    it("does not report a score when every sample is unchecked", async () => {
        const list = await readDtcgList({
            semantic: {
                color: {
                    text: color("#111111"),
                    background: color("#ffffff", 0.5),
                },
            },
        });

        const report = new TokenAuditor().auditList(list);

        expect(report.sampleCount).toBe(1);
        expect(report.unchecked).toHaveLength(1);
        expect(report.score).toBeUndefined();
    });

    it("runs only the allowed rules", async () => {
        const list = await readDtcgList({
            type: { caption: typography(10, 1) },
            color: { text: color("#a1a4aa"), background: color("#ffffff") },
        });

        expect(new TokenAuditor({ rules: ["line-height"] }).auditList(list).findings.map((finding) => finding.id))
            .toEqual(["line-height"]);
    });

    it("lists errors before warnings", async () => {
        const list = await readDtcgList({
            type: { caption: typography(10, 1.5) },
            color: { text: color("#a1a4aa"), background: color("#ffffff") },
        });

        const report = new TokenAuditor().auditList(list);

        expect(report.findings.map((finding) => [finding.id, finding.severity])).toEqual([
            ["text-contrast", "error"],
            ["text-size", "warning"],
        ]);
    });

    it("reads token sources", async () => {
        const source = "content:" + JSON.stringify({
            $schema: "",
            color: { text: color("#a1a4aa"), background: color("#ffffff") },
        });

        const result = await new TokenAuditor({ rules: ["text-contrast"] }).audit([source]);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.report.findings).toEqual([expect.objectContaining({ id: "text-contrast", sourcePath: source })]);
        }
    });

    it("returns the reading problems of unreadable sources", async () => {
        const result = await new TokenAuditor().audit(['content:{"color": ']);

        expect(result).toEqual({ ok: false, issues: [expect.objectContaining({ id: "json-syntax", severity: "error" })] });
    });

    it("names requested rules that do not exist", () => {
        expect(new TokenAuditor({ rules: ["text-size", "missing"] }).unknownRules()).toEqual(["missing"]);
        expect(new TokenAuditor().unknownRules()).toEqual([]);
    });
});
