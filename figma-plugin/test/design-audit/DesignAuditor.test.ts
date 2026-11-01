import { describe, expect, it } from "vitest";
import { DesignAuditor } from "#/figma-plugin/design-audit/DesignAuditor";
import { FigmaTextSampler } from "#/figma-plugin/design-audit/FigmaTextSampler";
import type { SrgbColor } from "@design-token-kit/core/core/audit/color/SrgbColor";
import type { TokenCandidate, UsageSample } from "@design-token-kit/core/core/audit/usage/UsageSample";
import type { SampledProperty } from "#/figma-plugin/design-audit/FigmaUsageSampler";
import { frame, gradient, page, solid, text, textNodes } from "./figmaNodes";

const CARD = { x: 0, y: 0, width: 200, height: 100 };
const LABEL = { x: 20, y: 20, width: 80, height: 20 };
const PARAGRAPH = { x: 20, y: 20, width: 80, height: 60 };

function audit(root: PageNode) {
    return new DesignAuditor().audit(new FigmaTextSampler().sample(textNodes(root)));
}

describe("DesignAuditor", () => {
    it("groups findings by problem, worst node first, and scores them", () => {
        const report = audit(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                text("Light", LABEL, { fills: [solid("#bbbbbb")] }),
                text("Lighter", LABEL, { fills: [solid("#dddddd")] }),
                text("Fine print", LABEL, { fontSize: 10 }),
                text("Tight", PARAGRAPH, { lineHeight: { unit: "PERCENT", value: 110 } }),
                text("Body", LABEL),
            ]),
            frame("Hero", CARD, [gradient()], [text("Title", LABEL)]),
        ]));

        expect(report.nodeCount).toBe(6);
        expect(report.counts).toEqual({ errors: 2, warnings: 2, notChecked: 1 });
        expect(report.contrastErrors).toBe(2);
        expect(report.scores).toEqual({ accessibility: { score: 96, grade: "A", errors: 2, warnings: 2 }, tokenUsage: undefined });
        expect(report.groups.map((group) => [group.id, group.severity, group.nodes.map((node) => node.name)])).toEqual([
            ["text-contrast-aa", "error", ["Lighter", "Light"]],
            ["text-size", "warning", ["Fine print"]],
            ["line-height", "warning", ["Tight"]],
            ["text-contrast-unchecked", "not-checked", ["Title"]],
        ]);
    });

    it("describes each group with its worst measurement", () => {
        const [contrast] = audit(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [text("Light", LABEL, { fills: [solid("#bbbbbb")] })]),
        ])).groups;

        expect(contrast).toMatchObject({
            title: "Text contrast is below WCAG AA",
            category: "accessibility",
            description: "Body text needs 4.5:1 and large text 3:1. The lowest ratio found is 1.91:1.",
            nodes: [{ id: "text:Light", name: "Light", path: "Card", meta: "1.91:1" }],
        });
    });

    it("reports contrast between AA and AAA as a warning when AAA is targeted", () => {
        const nodes = new FigmaTextSampler().sample(textNodes(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [text("Muted", LABEL, { fills: [solid("#707070")] })]),
        ])));

        const report = new DesignAuditor({ level: "AAA" }).audit(nodes);

        expect(report.level).toBe("AAA");
        expect(report.contrastErrors).toBe(0);
        expect(report.groups).toEqual([expect.objectContaining({
            id: "text-contrast-aaa",
            severity: "warning",
            title: "Text contrast is below WCAG AAA",
            description: "WCAG AAA asks 7:1 for body text and 4.5:1 for large text. The lowest ratio found is 4.95:1.",
        })]);
    });

    it("names the configured thresholds in titles and descriptions", () => {
        const nodes = new FigmaTextSampler().sample(textNodes(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                text("Small", LABEL, { fontSize: 13 }),
                text("Tight", PARAGRAPH, { fontSize: 19, lineHeight: { unit: "PERCENT", value: 120 } }),
            ]),
        ])));

        const report = new DesignAuditor({ minFontSizePx: 14, headingSizePx: 20, minBodyLineHeight: 1.4 }).audit(nodes);

        expect(report.groups.map((group) => [group.title, group.description, group.docsUrl])).toEqual([
            [
                "Text is smaller than 14px",
                "Text below 14px is hard to read. The smallest size found is 13px.",
                "https://design-token-kit.github.io/docs/guides/figma-plugin/#text-size",
            ],
            [
                "Body text lines are too tight",
                "Body text below 20px needs a line height of at least 1.4. The tightest found is 1.2.",
                "https://design-token-kit.github.io/docs/guides/figma-plugin/#line-height",
            ],
        ]);
    });

    it("marks text on a translucent background as not checked", () => {
        const report = new DesignAuditor().audit([{
            sample: {
                id: "1:2",
                label: "Floating",
                foreground: { red: 0, green: 0, blue: 0, alpha: 1 },
                background: { red: 1, green: 1, blue: 1, alpha: 0.5 },
            },
            node: { id: "1:2", name: "Floating", path: "Overlay" },
        }]);

        expect(report.groups).toEqual([expect.objectContaining({
            id: "text-contrast-unchecked",
            severity: "not-checked",
            nodes: [{ id: "1:2", name: "Floating", path: "Overlay", meta: "translucent" }],
        })]);
        expect(report.counts.notChecked).toBe(1);
        expect(report.scores.accessibility).toBeUndefined();
    });

    it("reports a clean page with a perfect score", () => {
        const report = audit(page("Page", [frame("Card", CARD, [solid("#ffffff")], [text("Body", LABEL)])]));

        expect(report.groups).toEqual([]);
        expect(report.scores.accessibility).toMatchObject({ score: 100, grade: "A" });
    });

    describe("token usage", () => {
        const blue: SrgbColor = { red: 0x25 / 255, green: 0x63 / 255, blue: 0xeb / 255, alpha: 1 };
        const candidates: TokenCandidate[] = [
            { kind: "variable", name: "primitive/blue/500", layer: "primitive", value: { type: "color", color: blue } },
            { kind: "variable", name: "semantic/accent", layer: "semantic", value: { type: "color", color: blue } },
            { kind: "variable", name: "spacing/4", value: { type: "dimension", px: 16 }, properties: ["gap", "padding"] },
        ];

        function property(id: string, sample: Omit<UsageSample, "id" | "label">): SampledProperty {
            return { sample: { id: `${id}#0`, label: id, ...sample }, node: { id, name: id, path: "Card" } };
        }

        const properties = [
            property("Off palette", { property: "fill", value: { type: "color", color: { red: 1, green: 0, blue: 0, alpha: 1 } } }),
            property("Button", { property: "fill", value: { type: "color", color: blue } }),
            property("Stack", { property: "padding", part: "top", value: { type: "dimension", px: 15 } }),
            property("Link", { property: "fill", value: { type: "color", color: blue },
                binding: { kind: "variable", name: "primitive/blue/500", layer: "primitive" } }),
            property("Badge", { property: "fill", value: { type: "color", color: blue },
                binding: { kind: "variable", name: "semantic/accent", layer: "semantic" } }),
        ];

        it("groups hard-coded values and primitive bindings, exact suggestions first", () => {
            const report = new DesignAuditor().audit([], properties, candidates);

            expect(report.groups.map((group) => [group.id, group.category, group.nodes.map((node) => [node.name, node.meta, node.note])])).toEqual([
                ["hardcoded-color", "token-usage", [
                    ["Button", "Fill #2563eb", "Use semantic/accent"],
                    ["Off palette", "Fill #ff0000", "No matching variable"],
                ]],
                ["hardcoded-spacing", "token-usage", [["Stack", "Padding top 15px", "Closest: spacing/4"]]],
                ["primitive-binding", "token-usage", [["Link", "Fill #2563eb", "Bound to primitive/blue/500 · Use semantic/accent"]]],
            ]);
            expect(report.groups[0].description).toBe("Hard-coded colours do not follow changes to the palette or the mode. "
                + "1 of 2 match a variable or style of this file.");
        });

        it("scores token usage apart from accessibility and reports the coverage", () => {
            const report = new DesignAuditor().audit([], properties, candidates);

            expect(report.layerCount).toBe(5);
            expect(report.counts).toEqual({ errors: 0, warnings: 4, notChecked: 0 });
            expect(report.coverage).toMatchObject({ total: 5, bound: 2, percent: 40 });
            expect(report.scores).toEqual({
                accessibility: { score: 100, grade: "A", errors: 0, warnings: 0 },
                tokenUsage: { score: 20, grade: "F", clean: 1, total: 5 },
            });
        });
    });
});
