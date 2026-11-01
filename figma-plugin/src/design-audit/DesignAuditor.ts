import type { AuditCategory, AuditFinding, UncheckedSubject } from "@design-token-kit/core/core/audit/AuditFinding";
import { computeAuditScore, type AuditScore } from "@design-token-kit/core/core/audit/AuditScore";
import { auditTextSamples } from "@design-token-kit/core/core/audit/accessibility/AccessibilityAudit";
import {
    toAccessibilitySettings,
    type AccessibilityOptions,
    type AccessibilitySettings,
} from "@design-token-kit/core/core/audit/accessibility/AccessibilitySettings";
import type { WcagLevel } from "@design-token-kit/core/core/audit/color/Wcag";
import {
    auditUsageSamples,
    formatUsageValue,
    type TokenCoverage,
    type TokenUsageScore,
} from "@design-token-kit/core/core/audit/usage/TokenUsageAudit";
import type { TokenCandidate, UsageProperty, UsageSample } from "@design-token-kit/core/core/audit/usage/UsageSample";
import type { AuditedNode, SampledTextNode } from "#/figma-plugin/design-audit/FigmaTextSampler";
import type { SampledProperty } from "#/figma-plugin/design-audit/FigmaUsageSampler";

const DOCS_URL = "https://design-token-kit.github.io/docs/guides/figma-plugin/";

/**
 * Audits sampled Figma nodes and groups the findings for the Design tab.
 *
 * Text nodes are audited for accessibility and readability, the properties of
 * every layer for token usage. Each group is one problem, such as text
 * contrast below WCAG AA, with the nodes that have it, worst first. Nodes
 * whose contrast cannot be measured form a separate "not checked" group that
 * does not affect the score. Each category has its own score.
 */
export class DesignAuditor {
    readonly #options: AccessibilityOptions;

    constructor(options: AccessibilityOptions = {}) {
        this.#options = options;
    }

    /**
     * @param nodes - Sampled text nodes, for the accessibility audit.
     * @param properties - Sampled layer properties, for the token usage audit.
     * @param candidates - Tokens of the file a hard-coded value could be replaced with.
     */
    audit(
        nodes: readonly SampledTextNode[],
        properties: readonly SampledProperty[] = [],
        candidates: readonly TokenCandidate[] = [],
    ): DesignAuditReport {
        const settings = toAccessibilitySettings(this.#options);
        const byId = new Map(nodes.map((entry) => [entry.node.id, entry.node]));
        const { findings, unchecked } = auditTextSamples(nodes.map((entry) => entry.sample), settings);
        const usage = auditUsageSamples(properties.map((entry) => entry.sample), candidates);
        const sampled = new Map(properties.map((entry) => [entry.sample.id, entry]));

        const groups = [
            ...GROUP_DEFINITIONS.map((definition) => toGroup(definition, findings, byId, settings)),
            ...USAGE_GROUP_DEFINITIONS.map((definition) => toUsageGroup(definition, usage.findings, sampled)),
            toUncheckedGroup(unchecked, byId),
        ].filter((group): group is FindingGroup => group !== undefined);

        const errors = findings.filter((finding) => finding.severity === "error").length;
        const warnings = findings.length - errors;
        const accessibility = nodes.length > 0 && unchecked.length >= nodes.length
            ? undefined
            : { ...computeAuditScore(errors, warnings), errors, warnings };
        return {
            level: settings.level,
            nodeCount: nodes.length,
            layerCount: new Set(properties.map((entry) => entry.node.id)).size,
            coverage: usage.coverage,
            scores: {
                accessibility,
                tokenUsage: usage.score,
            },
            counts: { errors, warnings: warnings + usage.findings.length, notChecked: unchecked.length },
            contrastErrors: findings.filter((finding) => finding.id === "text-contrast" && finding.severity === "error").length,
            groups,
        };
    }
}

/**
 * Findings of a design audit, as the Design tab shows them.
 */
export interface DesignAuditReport {
    /** WCAG level text contrast was audited against. */
    readonly level: WcagLevel;

    /** Number of text nodes audited. */
    readonly nodeCount: number;

    /** Number of layers whose properties were audited for token usage. */
    readonly layerCount: number;

    /** How many of the audited properties are bound to variables or styles. */
    readonly coverage: TokenCoverage;

    /**
     * Scores of each category, kept apart: accessibility is scored from the
     * WCAG and readability findings of text, token usage from the share of
     * properties without a finding.
     */
    readonly scores: {
        readonly accessibility?: AccessibilityScore;

        /** `undefined` when no property was audited. */
        readonly tokenUsage?: TokenUsageScore;
    };

    /** Number of findings of each severity, over all categories. */
    readonly counts: {
        readonly errors: number;
        readonly warnings: number;
        readonly notChecked: number;
    };

    /** Number of nodes failing the WCAG AA contrast minimum. */
    readonly contrastErrors: number;

    /** Problems found, errors first, then warnings, then what could not be checked. */
    readonly groups: FindingGroup[];
}

/**
 * Accessibility score: `100 - 2 × errors - 0.1 × warnings`, with the numbers
 * it was computed from.
 */
export interface AccessibilityScore extends AuditScore {
    readonly errors: number;
    readonly warnings: number;
}

/**
 * One problem and the nodes that have it.
 */
export interface FindingGroup {
    readonly id: string;
    readonly severity: "error" | "warning" | "not-checked";
    readonly category: AuditCategory;
    readonly title: string;
    readonly description: string;
    readonly fix: string;
    readonly docsUrl: string;
    readonly nodes: FindingNode[];
}

/**
 * A node listed under a finding group.
 */
export interface FindingNode {
    readonly id: string;
    readonly name: string;
    readonly path: string;

    /** The measured value, e.g. `2.9:1`, or why the node could not be checked. */
    readonly meta: string;

    /** What to do about the node, e.g. the variable to bind. */
    readonly note?: string;
}

interface GroupDefinition {
    readonly id: string;
    readonly ruleId: string;
    readonly severity: "error" | "warning";
    readonly title: (settings: AccessibilitySettings) => string;
    readonly description: (settings: AccessibilitySettings, worst: string | undefined) => string;
    readonly fix: string;
}

const GROUP_DEFINITIONS: readonly GroupDefinition[] = [
    {
        id: "text-contrast-aa",
        ruleId: "text-contrast",
        severity: "error",
        title: () => "Text contrast is below WCAG AA",
        description: (_settings, worst) => `Body text needs 4.5:1 and large text 3:1. The lowest ratio found is ${worst}.`,
        fix: "Use a darker text colour on light surfaces and a lighter one on dark surfaces, ideally a semantic text variable.",
    },
    {
        id: "text-contrast-aaa",
        ruleId: "text-contrast",
        severity: "warning",
        title: () => "Text contrast is below WCAG AAA",
        description: (_settings, worst) => `WCAG AAA asks 7:1 for body text and 4.5:1 for large text. The lowest ratio found is ${worst}.`,
        fix: "Raise the contrast where the text must meet AAA, for example body copy and form labels.",
    },
    {
        id: "text-size",
        ruleId: "text-size",
        severity: "warning",
        title: (settings) => `Text is smaller than ${settings.minFontSizePx}px`,
        description: (settings, worst) => `Text below ${settings.minFontSizePx}px is hard to read. The smallest size found is ${worst}.`,
        fix: "Apply a text style from the typography scale that is large enough to read.",
    },
    {
        id: "line-height",
        ruleId: "line-height",
        severity: "warning",
        title: () => "Body text lines are too tight",
        description: (settings, worst) => `Body text below ${settings.headingSizePx}px needs a line height of at least ${settings.minBodyLineHeight}. `
            + `The tightest found is ${worst}.`,
        fix: "Increase the line height, or apply a body text style.",
    },
];

function toGroup(
    definition: GroupDefinition,
    findings: AuditFinding[],
    nodes: Map<string, AuditedNode>,
    settings: AccessibilitySettings,
): FindingGroup | undefined {
    const matching = findings
        .filter((finding) => finding.id === definition.ruleId && finding.severity === definition.severity)
        .sort((a, b) => measuredValue(a) - measuredValue(b));
    if (matching.length === 0) return undefined;

    return {
        id: definition.id,
        severity: definition.severity,
        category: "accessibility",
        title: definition.title(settings),
        description: definition.description(settings, matching[0].measurement),
        fix: definition.fix,
        docsUrl: `${DOCS_URL}#${definition.ruleId}`,
        nodes: matching.map((finding) => toFindingNode(finding.subjectId, finding.measurement ?? "", nodes)),
    };
}

function toUncheckedGroup(unchecked: UncheckedSubject[], nodes: Map<string, AuditedNode>): FindingGroup | undefined {
    if (unchecked.length === 0) return undefined;
    return {
        id: "text-contrast-unchecked",
        severity: "not-checked",
        category: "accessibility",
        title: "Text contrast could not be evaluated",
        description: "The text sits on a gradient, an image or mixed fills, so the ratio cannot be calculated automatically.",
        fix: "Check these by eye, or put a solid fill behind the text.",
        docsUrl: `${DOCS_URL}#text-contrast`,
        nodes: unchecked.map((subject) => {
            const node = nodes.get(subject.subjectId);
            return toFindingNode(subject.subjectId, node?.problem ?? "translucent", nodes);
        }),
    };
}

function toFindingNode(id: string, meta: string, nodes: Map<string, AuditedNode>): FindingNode {
    const node = nodes.get(id);
    return { id, name: node?.name ?? id, path: node?.path ?? "", meta };
}

function measuredValue(finding: AuditFinding): number {
    const value = Number.parseFloat(finding.measurement ?? "");
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

interface UsageGroupDefinition {
    readonly id: string;
    readonly ruleId: string;
    readonly properties: readonly UsageProperty[];
    readonly title: string;
    readonly description: (count: number, matched: number) => string;
    readonly fix: string;
}

const PROPERTY_LABELS: Record<UsageProperty, string> = {
    "fill": "Fill",
    "stroke": "Stroke",
    "corner-radius": "Radius",
    "gap": "Gap",
    "padding": "Padding",
    "font-size": "Font size",
};

const USAGE_GROUP_DEFINITIONS: readonly UsageGroupDefinition[] = [
    {
        id: "hardcoded-color",
        ruleId: "hardcoded-value",
        properties: ["fill", "stroke"],
        title: "Colours are not bound to variables",
        description: (count, matched) => "Hard-coded colours do not follow changes to the palette or the mode. "
            + `${matched} of ${count} match a variable or style of this file.`,
        fix: "Bind the colour to the suggested variable or style. A colour with no match is off the palette: pick the nearest one.",
    },
    {
        id: "hardcoded-spacing",
        ruleId: "hardcoded-value",
        properties: ["gap", "padding", "corner-radius"],
        title: "Spacing and radii are not bound to variables",
        description: (count, matched) => "Hard-coded gaps, paddings and radii drift from the spacing scale. "
            + `${matched} of ${count} match a variable of this file.`,
        fix: "Bind the value to the suggested variable. A value with no match is off the scale: round it to a step of the scale.",
    },
    {
        id: "hardcoded-font-size",
        ruleId: "hardcoded-value",
        properties: ["font-size"],
        title: "Text has no text style",
        description: (count, matched) => "Text without a style or a font size variable drifts from the type scale. "
            + `${matched} of ${count} match a text style or variable of this file.`,
        fix: "Apply a text style from the typography scale.",
    },
    {
        id: "primitive-binding",
        ruleId: "primitive-binding",
        properties: ["fill", "stroke", "gap", "padding", "corner-radius", "font-size"],
        title: "Layers use primitive variables directly",
        description: (count, matched) => "Primitive variables hold raw values; layers should use semantic ones, "
            + `which carry a role and follow modes. ${matched} of ${count} have a semantic variable with the same value.`,
        fix: "Bind the suggested semantic variable instead of the primitive one.",
    },
];

function toUsageGroup(
    definition: UsageGroupDefinition,
    findings: AuditFinding[],
    sampled: Map<string, SampledProperty>,
): FindingGroup | undefined {
    const matching = findings
        .map((finding) => ({ finding, entry: sampled.get(finding.subjectId) }))
        .filter((item): item is { finding: AuditFinding; entry: SampledProperty } => item.finding.id === definition.ruleId
            && item.entry !== undefined && definition.properties.includes(item.entry.sample.property))
        // Exact suggestions first, as they are the quickest to fix, then close ones.
        .sort((a, b) => suggestionRank(a.finding) - suggestionRank(b.finding));
    if (matching.length === 0) return undefined;

    const matched = matching.filter((item) => item.finding.suggestion !== undefined).length;
    return {
        id: definition.id,
        severity: "warning",
        category: "token-usage",
        title: definition.title,
        description: definition.description(matching.length, matched),
        fix: definition.fix,
        docsUrl: `${DOCS_URL}#${definition.ruleId}`,
        nodes: matching.map(({ finding, entry }) => ({
            id: entry.node.id,
            name: entry.node.name,
            path: entry.node.path,
            meta: propertyMeta(entry.sample),
            note: usageNote(finding),
        })),
    };
}

function suggestionRank(finding: AuditFinding): number {
    if (finding.suggestion === undefined) return 2;
    return finding.suggestion.exact ? 0 : 1;
}

function propertyMeta(sample: UsageSample): string {
    const label = sample.part === undefined ? PROPERTY_LABELS[sample.property] : `${PROPERTY_LABELS[sample.property]} ${sample.part}`;
    return `${label} ${formatUsageValue(sample.value)}`;
}

function usageNote(finding: AuditFinding): string {
    const suggestion = finding.suggestion === undefined ? undefined
        : finding.suggestion.exact ? `Use ${finding.suggestion.name}` : `Closest: ${finding.suggestion.name}`;
    if (finding.id === "primitive-binding") {
        return suggestion === undefined ? `Bound to ${finding.measurement}` : `Bound to ${finding.measurement} · ${suggestion}`;
    }
    return suggestion ?? "No matching variable";
}
