import type { AuditCategory, AuditFinding, UncheckedSubject } from "@design-token-kit/core/core/audit/AuditFinding";
import {
    auditTextContrastSamples,
    computeContrastScore,
    type ContrastScore,
} from "@design-token-kit/core/core/audit/accessibility/ContrastAudit";
import {
    toAccessibilitySettings,
    type AccessibilityOptions,
    type AccessibilitySettings,
} from "@design-token-kit/core/core/audit/accessibility/AccessibilitySettings";
import {
    compositeOver,
    contrastRatio,
    formatContrastRatio,
    type WcagLevel,
} from "@design-token-kit/core/core/audit/color/Wcag";
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
const NON_TEXT_CONTRAST_DOCS_URL = "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html";

/**
 * Audits sampled Figma nodes and groups the findings for the Design tab.
 *
 * Text nodes are audited for automated WCAG text contrast, symbolic graphics
 * are reported for non-text contrast review, and the properties of every layer
 * are audited for token usage. Nodes whose contrast cannot be measured form a
 * separate manual-review group and do not affect the score.
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
        const nonTextCandidates = nodes.filter(isNonTextCandidate);
        const textNodes = nodes.filter((entry) => !isNonTextCandidate(entry));
        const { findings, unchecked, score: textScore } = auditTextContrastSamples(
            textNodes.map((entry) => entry.sample),
            settings,
        );
        const score = addManualReviews(textScore, nonTextCandidates.length);
        const usage = auditUsageSamples(properties.map((entry) => entry.sample), candidates);
        const sampled = new Map(properties.map((entry) => [entry.sample.id, entry]));

        const groups = [
            ...GROUP_DEFINITIONS.map((definition) => toGroup(definition, findings, byId, settings)),
            toNonTextManualGroup(nonTextCandidates, byId),
            ...USAGE_GROUP_DEFINITIONS.map((definition) => toUsageGroup(definition, usage.findings, sampled)),
            toUncheckedGroup(unchecked, byId),
        ].filter((group): group is FindingGroup => group !== undefined);

        const errors = findings.filter((finding) => finding.severity === "error").length;
        const warnings = findings.length - errors;
        return {
            level: settings.level,
            nodeCount: nodes.length,
            layerCount: new Set(properties.map((entry) => entry.node.id)).size,
            coverage: usage.coverage,
            scores: {
                accessibility: nodes.length > 0 ? score : undefined,
                tokenUsage: usage.score,
            },
            counts: {
                errors,
                warnings: warnings + usage.findings.length,
                notChecked: unchecked.length + nonTextCandidates.length,
            },
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
     * Scores of each category, kept apart: accessibility is scored from
     * automated text contrast checks, while symbolic non-text candidates only
     * contribute manual-review counts. Token usage is scored from the share of
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
 * Percentage score and outcome counts for automated text contrast checks.
 */
export type AccessibilityScore = ContrastScore;

/**
 * One problem and the nodes that have it.
 */
export interface FindingGroup {
    readonly id: string;
    readonly severity: "error" | "warning" | "not-checked";
    readonly category: AuditCategory;
    readonly title: string;
    readonly description: string;
    readonly stats?: string;
    readonly fix?: string;
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

    /** Full diagnostic detail kept out of the main row when a short note is shown. */
    readonly detail?: string;
}

interface GroupDefinition {
    readonly id: string;
    readonly ruleId: string;
    readonly severity: "error" | "warning";
    readonly title: (settings: AccessibilitySettings) => string;
    readonly description: (settings: AccessibilitySettings, worst: string | undefined) => string;
    readonly docsUrl: string;
}

const GROUP_DEFINITIONS: readonly GroupDefinition[] = [
    {
        id: "text-contrast-aa",
        ruleId: "text-contrast",
        severity: "error",
        title: () => "Low text contrast (WCAG AA)",
        description: (_settings, worst) => `Body text needs 4.5:1 and large text 3:1. The lowest ratio found is ${worst}.`,
        docsUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    },
    {
        id: "text-contrast-aaa",
        ruleId: "text-contrast",
        severity: "warning",
        title: () => "Low text contrast (WCAG AAA)",
        description: (_settings, worst) => `WCAG AAA asks 7:1 for body text and 4.5:1 for large text. The lowest ratio found is ${worst}.`,
        docsUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html",
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
        docsUrl: definition.docsUrl,
        nodes: matching.map((finding) => toFindingNode(finding.subjectId, finding.measurement ?? "", nodes)),
    };
}

function toUncheckedGroup(unchecked: UncheckedSubject[], nodes: Map<string, AuditedNode>): FindingGroup | undefined {
    if (unchecked.length === 0) return undefined;
    return {
        id: "text-contrast-unchecked",
        severity: "not-checked",
        category: "accessibility",
        title: "Contrast needs manual review",
        description: "Some text uses images, gradients, mixed fills, transparency, or symbols with an uncertain role, so contrast needs manual review.",
        docsUrl: `${DOCS_URL}#design-audit-manual-review`,
        nodes: unchecked.map((subject) => {
            const node = nodes.get(subject.subjectId);
            return toFindingNode(subject.subjectId, node?.manualReviewReason ?? node?.problem ?? "translucent", nodes);
        }),
    };
}

function toNonTextManualGroup(
    candidates: readonly SampledTextNode[],
    nodes: Map<string, AuditedNode>,
): FindingGroup | undefined {
    if (candidates.length === 0) return undefined;
    return {
        id: "non-text-contrast-unchecked",
        severity: "not-checked",
        category: "accessibility",
        title: "Non-text contrast needs manual review",
        description: "Some graphical elements need manual review to determine their purpose or contrast.",
        docsUrl: NON_TEXT_CONTRAST_DOCS_URL,
        nodes: candidates.map((candidate) => toFindingNode(
            candidate.node.id,
            nonTextContrastMeta(candidate.sample),
            nodes,
            {
                note: "Role unclear",
                detail: candidate.sample.manualReviewReason
                    ?? candidate.node.manualReviewReason
                    ?? "the graphical element's purpose or contrast is uncertain",
            },
        )),
    };
}

function nonTextContrastMeta(sample: SampledTextNode["sample"]): string {
    const { foreground, background } = sample;
    if (sample.colorProblem !== undefined
        || foreground === undefined
        || background === undefined
        || background.alpha < 1) {
        return "Contrast unavailable";
    }
    const renderedForeground = compositeOver(foreground, background);
    return formatContrastRatio(contrastRatio(renderedForeground, background));
}

function isNonTextCandidate(entry: SampledTextNode): boolean {
    return entry.sample.manualReviewReason !== undefined;
}

function addManualReviews(score: ContrastScore, additionalReviews: number): ContrastScore {
    return computeContrastScore(
        score.passed,
        score.failed,
        score.manualReview + additionalReviews,
        score.skipped,
    );
}

function toFindingNode(
    id: string,
    meta: string,
    nodes: Map<string, AuditedNode>,
    extra: Pick<FindingNode, "note" | "detail"> = {},
): FindingNode {
    const node = nodes.get(id);
    return { id, name: node?.name ?? id, path: node?.path ?? "", meta, ...extra };
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
    readonly statistics?: (count: number, matched: number) => string;
    readonly fix?: string;
    readonly suggestionLabels?: SuggestionLabels;
}

interface SuggestionLabels {
    readonly exactPrefix: string;
    readonly closestPrefix: string;
    readonly missing: string;
    readonly boundPrefix?: string;
}

const MATCHING_VALUE_SUGGESTION_LABELS: SuggestionLabels = {
    exactPrefix: "Exact match: ",
    closestPrefix: "Closest match: ",
    missing: "No match found",
};

const FONT_SIZE_SUGGESTION_LABELS: SuggestionLabels = {
    exactPrefix: "Exact font-size match: ",
    closestPrefix: "Closest font-size match: ",
    missing: "No font-size match found",
};

const PRIMITIVE_BINDING_SUGGESTION_LABELS: SuggestionLabels = {
    exactPrefix: "Exact value match: ",
    closestPrefix: "Closest value match: ",
    missing: "No higher-level match found",
    boundPrefix: "Bound to: ",
};

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
        title: "Hard-coded colors",
        description: () => "Some fills and strokes use fixed colors instead of Variables or Styles.",
        statistics: (count, matched) => `${matched} of ${count} properties have a matching Variable or Style`,
        suggestionLabels: MATCHING_VALUE_SUGGESTION_LABELS,
    },
    {
        id: "hardcoded-spacing",
        ruleId: "hardcoded-value",
        properties: ["gap", "padding", "corner-radius"],
        title: "Hard-coded spacing and radii",
        description: () => "Some gaps, padding, and corner radii use fixed values instead of Variables.",
        statistics: (count, matched) => `${matched} of ${count} properties have a matching Variable`,
        suggestionLabels: MATCHING_VALUE_SUGGESTION_LABELS,
    },
    {
        id: "hardcoded-font-size",
        ruleId: "hardcoded-value",
        properties: ["font-size"],
        title: "Unbound font sizes",
        description: () => "Some text uses fixed font sizes instead of Text Styles or Variables.",
        statistics: (count, matched) => `${matched} of ${count} properties have a matching Text Style or Variable`,
        suggestionLabels: FONT_SIZE_SUGGESTION_LABELS,
    },
    {
        id: "primitive-binding",
        ruleId: "primitive-binding",
        properties: ["fill", "stroke", "gap", "padding", "corner-radius", "font-size"],
        title: "Direct primitive bindings",
        description: () => "Some layer properties use Primitive Variables directly instead of role-based tokens.",
        statistics: (count, matched) => `${matched} of ${count} properties have a possible higher-level match`,
        suggestionLabels: PRIMITIVE_BINDING_SUGGESTION_LABELS,
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
        stats: definition.statistics?.(matching.length, matched),
        fix: definition.fix,
        docsUrl: `${DOCS_URL}#${definition.ruleId}`,
        nodes: matching.map(({ finding, entry }) => ({
            id: entry.node.id,
            name: entry.node.name,
            path: entry.node.path,
            meta: propertyMeta(entry.sample),
            note: usageNote(finding, definition.suggestionLabels),
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

function usageNote(finding: AuditFinding, labels?: SuggestionLabels): string {
    const suggestion = finding.suggestion === undefined ? undefined
        : labels === undefined
            ? finding.suggestion.exact ? `Use ${finding.suggestion.name}` : `Closest: ${finding.suggestion.name}`
            : finding.suggestion.exact
                ? `${labels.exactPrefix}${finding.suggestion.name}`
                : `${labels.closestPrefix}${finding.suggestion.name}`;
    if (finding.id === "primitive-binding") {
        const bound = `${labels?.boundPrefix ?? "Bound to "}${finding.measurement}`;
        const match = suggestion ?? labels?.missing;
        return match === undefined ? bound : `${bound} · ${match}`;
    }
    return suggestion ?? (labels?.missing ?? "No matching variable");
}
