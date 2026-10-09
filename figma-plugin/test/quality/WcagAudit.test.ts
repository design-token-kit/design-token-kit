import { describe, expect, it } from "vitest";
import { auditWcagPage } from "#/figma-plugin/quality/WcagAudit";

describe("auditWcagPage", () => {
    it("passes black normal text on a white canvas", async () => {
        const report = await auditWcagPage(createPage([createTextNode("#000000")]));

        expect(report.score).toBe(100);
        expect(report.grade).toBe("A");
        expect(report.errors).toBe(0);
        expect(report.warnings).toBe(0);
        expect(report.nodesChecked).toBe(1);
        expect(report.findings).toEqual([]);
    });

    it("reports normal text below the WCAG AA threshold", async () => {
        const report = await auditWcagPage(createPage([createTextNode("#777777")]));

        expect(report.score).toBe(0);
        expect(report.grade).toBe("F");
        expect(report.errors).toBe(1);
        expect(report.findings[0]).toMatchObject({
            ruleId: "wcag-contrast",
            severity: "error",
            nodeId: "text-1",
            requiredRatio: 4.5,
        });
    });

    it("uses the lower threshold for large text", async () => {
        const report = await auditWcagPage(createPage([
            createTextNode("#777777", { fontSize: 18 }),
        ]));

        expect(report.score).toBe(100);
        expect(report.errors).toBe(0);
        expect(report.findings).toEqual([]);
    });

    it("uses a solid ancestor as the background", async () => {
        const background = createBackgroundNode("#000000");
        const text = createTextNode("#ffffff", { parent: background });
        const report = await auditWcagPage(createPage([text]));

        expect(report.score).toBe(100);
        expect(report.findings).toEqual([]);
    });

    it("returns a warning when text paint cannot be evaluated", async () => {
        const text = createTextNodeWithMixedFills();
        const report = await auditWcagPage(createPage([text]));

        expect(report.score).toBeNull();
        expect(report.warnings).toBe(1);
        expect(report.findings[0]).toMatchObject({
            ruleId: "wcag-not-evaluable",
            severity: "warning",
        });
    });
});

function createPage(nodes: TextNode[]): PageNode {
    // Fixtures model only the Plugin API members consumed by the audit.
    return {
        loadAsync: async () => {},
        children: nodes,
    } as unknown as PageNode;
}

function createTextNode(
    color: string,
    options: { fontSize?: number; parent?: BaseNode | null } = {},
): TextNode {
    return {
        id: "text-1",
        name: "Body text",
        type: "TEXT",
        visible: true,
        parent: options.parent ?? null,
        fills: [createSolidPaint(color)],
        fontSize: options.fontSize ?? 16,
        fontWeight: 400,
    } as unknown as TextNode;
}

function createTextNodeWithMixedFills(): TextNode {
    return {
        id: "text-1",
        name: "Mixed text",
        type: "TEXT",
        visible: true,
        parent: null,
        fills: Symbol("mixed"),
        fontSize: 16,
        fontWeight: 400,
    } as unknown as TextNode;
}

function createBackgroundNode(color: string): BaseNode {
    return {
        type: "RECTANGLE",
        visible: true,
        parent: null,
        fills: [createSolidPaint(color)],
    } as unknown as BaseNode;
}

function createSolidPaint(color: string): SolidPaint {
    const red = Number.parseInt(color.slice(1, 3), 16) / 255;
    const green = Number.parseInt(color.slice(3, 5), 16) / 255;
    const blue = Number.parseInt(color.slice(5, 7), 16) / 255;

    return {
        type: "SOLID",
        color: { r: red, g: green, b: blue },
        opacity: 1,
        visible: true,
        blendMode: "NORMAL",
    };
}
