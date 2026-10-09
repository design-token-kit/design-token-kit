/**
 * A single WCAG contrast finding for a text node.
 */
export interface WcagFinding {
    id: string;
    ruleId: "wcag-contrast" | "wcag-not-evaluable";
    severity: "error" | "warning";
    title: string;
    message: string;
    recommendation: string;
    nodeId: string;
    nodeName: string;
    contrastRatio?: number;
    requiredRatio?: number;
}

/**
 * The WCAG audit result for the current Figma page.
 */
export interface WcagAuditReport {
    score: number | null;
    grade: string;
    errors: number;
    warnings: number;
    nodesChecked: number;
    findings: WcagFinding[];
    message: string;
}

interface AuditColor {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

interface AuditEvaluation {
    status: "pass" | "error" | "warning";
    finding?: WcagFinding;
    contrastRatio?: number;
}

const WHITE: AuditColor = { red: 1, green: 1, blue: 1, alpha: 1 };
const NORMAL_TEXT_RATIO = 4.5;
const LARGE_TEXT_RATIO = 3;

/**
 * Audits visible text nodes on one Figma page against WCAG AA contrast rules.
 *
 * The first implementation evaluates single solid fills and uses the nearest
 * solid ancestor fill as the background. Complex paint combinations are
 * reported as warnings instead of being treated as contrast failures.
 */
export async function auditWcagPage(page: PageNode): Promise<WcagAuditReport> {
    await page.loadAsync();
    const textNodes = collectTextNodes(page.children)
        .filter((node): node is TextNode => isVisibleInTree(node));
    const evaluations = textNodes.map(evaluateTextNode);
    const findings = evaluations.flatMap((evaluation) => evaluation.finding === undefined
        ? []
        : [evaluation.finding]);
    const checkedNodes = evaluations.filter((evaluation) => evaluation.status !== "warning");
    const passingNodes = checkedNodes.filter((evaluation) => evaluation.status === "pass").length;
    const score = checkedNodes.length === 0 ? null : Math.round((passingNodes / checkedNodes.length) * 100);

    return {
        score,
        grade: score === null ? "-" : toGrade(score),
        errors: findings.filter((finding) => finding.severity === "error").length,
        warnings: findings.filter((finding) => finding.severity === "warning").length,
        nodesChecked: checkedNodes.length,
        findings,
        message: toAuditMessage(score, findings),
    };
}

function collectTextNodes(nodes: ReadonlyArray<SceneNode>): TextNode[] {
    return nodes.flatMap((node) => {
        const childTextNodes = "children" in node ? collectTextNodes(node.children) : [];
        return node.type === "TEXT" ? [node, ...childTextNodes] : childTextNodes;
    });
}

function evaluateTextNode(node: TextNode): AuditEvaluation {
    const foreground = readSingleSolidPaint(readFills(node) ?? []);
    const background = findBackground(node);
    const fontSize = typeof node.fontSize === "number" ? node.fontSize : undefined;
    const fontWeight = typeof node.fontWeight === "number" ? node.fontWeight : undefined;

    if (foreground === undefined || background === undefined || fontSize === undefined || fontWeight === undefined) {
        return {
            status: "warning",
            finding: createNotEvaluableFinding(node),
        };
    }

    const contrastRatio = contrast(foreground, background);
    const requiredRatio = isLargeText(fontSize, fontWeight)
        ? LARGE_TEXT_RATIO
        : NORMAL_TEXT_RATIO;

    if (contrastRatio >= requiredRatio) {
        return { status: "pass", contrastRatio };
    }

    return {
        status: "error",
        contrastRatio,
        finding: {
            id: `wcag-contrast-${node.id}`,
            ruleId: "wcag-contrast",
            severity: "error",
            title: "Text contrast is below WCAG AA",
            message: `${node.name} has a contrast ratio of ${formatRatio(contrastRatio)}:1. `
                + `At least ${formatRatio(requiredRatio)}:1 is required.`,
            recommendation: "Use a darker text color or a lighter background.",
            nodeId: node.id,
            nodeName: node.name,
            contrastRatio,
            requiredRatio,
        },
    };
}

function createNotEvaluableFinding(node: TextNode): WcagFinding {
    return {
        id: `wcag-not-evaluable-${node.id}`,
        ruleId: "wcag-not-evaluable",
        severity: "warning",
        title: "Text contrast could not be evaluated",
        message: `${node.name} uses a mixed or unsupported paint configuration.`,
        recommendation: "Use a single solid text fill and a detectable solid background.",
        nodeId: node.id,
        nodeName: node.name,
    };
}

function findBackground(node: TextNode): AuditColor | undefined {
    let parent: BaseNode | null = node.parent;

    while (parent !== null) {
        const fills = readFills(parent);
        if (fills !== undefined && fills.length > 0) {
            const background = readSingleSolidPaint(fills);
            return background === undefined ? undefined : composite(background, WHITE);
        }
        parent = parent.parent;
    }

    return WHITE;
}

function readFills(node: BaseNode): ReadonlyArray<Paint> | undefined {
    if (!("fills" in node) || !Array.isArray(node.fills)) {
        return undefined;
    }

    return node.fills;
}

function readSingleSolidPaint(paints: ReadonlyArray<Paint>): AuditColor | undefined {
    const visiblePaints = paints.filter((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0);
    if (visiblePaints.length !== 1 || visiblePaints[0]?.type !== "SOLID") {
        return undefined;
    }

    const paint = visiblePaints[0];
    return {
        red: paint.color.r,
        green: paint.color.g,
        blue: paint.color.b,
        alpha: paint.opacity ?? 1,
    };
}

function contrast(foreground: AuditColor, background: AuditColor): number {
    const foregroundLuminance = luminance(composite(foreground, background));
    const backgroundLuminance = luminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
}

function composite(source: AuditColor, destination: AuditColor): AuditColor {
    const alpha = source.alpha + destination.alpha * (1 - source.alpha);
    if (alpha === 0) {
        return WHITE;
    }

    return {
        red: (source.red * source.alpha + destination.red * destination.alpha * (1 - source.alpha)) / alpha,
        green: (source.green * source.alpha + destination.green * destination.alpha * (1 - source.alpha)) / alpha,
        blue: (source.blue * source.alpha + destination.blue * destination.alpha * (1 - source.alpha)) / alpha,
        alpha,
    };
}

function luminance(color: AuditColor): number {
    return 0.2126 * linearChannel(color.red)
        + 0.7152 * linearChannel(color.green)
        + 0.0722 * linearChannel(color.blue);
}

function linearChannel(channel: number): number {
    return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
}

function isLargeText(fontSize: number, fontWeight: number): boolean {
    return fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
}

function isVisibleInTree(node: BaseNode): boolean {
    let current: BaseNode | null = node;

    while (current !== null) {
        if ("visible" in current && current.visible === false) {
            return false;
        }
        current = current.parent;
    }

    return true;
}

function formatRatio(ratio: number): string {
    return ratio.toFixed(2);
}

function toGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

function toAuditMessage(score: number | null, findings: WcagFinding[]): string {
    if (score === null) {
        return "No evaluable text nodes were found on the current page.";
    }

    const errors = findings.filter((finding) => finding.severity === "error").length;
    return errors === 0
        ? "Good. All checked text passes WCAG AA."
        : `Fix ${errors} error${errors === 1 ? "" : "s"} to pass WCAG AA.`;
}
