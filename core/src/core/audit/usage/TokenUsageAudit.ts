import type { AuditFinding, AuditRuleInfo } from "#/core/audit/AuditFinding";
import { auditGrade, type AuditScore } from "#/core/audit/AuditScore";
import { formatSrgbColor } from "#/core/audit/color/SrgbColor";
import { formatNumber } from "#/core/audit/accessibility/TextAuditRule";
import { TokenMatcher, type TokenMatch, type TokenMatcherOptions } from "#/core/audit/usage/TokenMatcher";
import type { TokenCandidate, UsageProperty, UsageSample, UsageValue } from "#/core/audit/usage/UsageSample";
import { TokenLayers } from "#/core/check/TokenLayers";

const HARDCODED_VALUE = "hardcoded-value";
const PRIMITIVE_BINDING = "primitive-binding";

const RULES: readonly AuditRuleInfo[] = [
    {
        id: HARDCODED_VALUE,
        category: "token-usage",
        severity: "warning",
        description: "A color, spacing, radius or font size is hard-coded instead of bound to a token.",
    },
    {
        id: PRIMITIVE_BINDING,
        category: "token-usage",
        severity: "warning",
        description: "A property is bound to a token of the lowest layer, when tokens of higher layers exist.",
    },
];

const PROPERTY_LABELS: Record<UsageProperty, string> = {
    "fill": "fill",
    "stroke": "stroke",
    "corner-radius": "corner radius",
    "gap": "gap",
    "padding": "padding",
    "font-size": "font size",
};

/**
 * Returns metadata for every token usage rule.
 */
export function listTokenUsageRules(): AuditRuleInfo[] {
    return [...RULES];
}

/**
 * Options of {@link auditUsageSamples}.
 */
export interface TokenUsageOptions extends TokenMatcherOptions {
    /**
     * Allow-list of rule ids to run. When omitted or empty, every rule runs.
     */
    readonly rules?: readonly string[];
}

/**
 * Outcome of a token usage audit.
 */
export interface TokenUsageResult {
    readonly findings: AuditFinding[];
    readonly coverage: TokenCoverage;

    /** Score of the token usage; `undefined` when nothing was audited. */
    readonly score?: TokenUsageScore;
}

/**
 * Token usage score: the share of audited properties without a finding, in
 * percent, rounded down, with its letter grade.
 */
export interface TokenUsageScore extends AuditScore {
    /** Number of properties without a finding. */
    readonly clean: number;

    /** Number of properties audited. */
    readonly total: number;
}

/**
 * How many properties are bound to tokens.
 */
export interface TokenCoverage {
    /** Number of properties audited. */
    readonly total: number;

    /** Number of properties bound to a variable or a style. */
    readonly bound: number;

    /** Bound properties in percent, rounded down; `undefined` when nothing was audited. */
    readonly percent?: number;

    /** Totals of each property audited. */
    readonly byProperty: Partial<Record<UsageProperty, { readonly total: number; readonly bound: number }>>;
}

/**
 * Audits whether design properties are built from tokens.
 *
 * Two rules apply, both reporting warnings:
 *
 * - `hardcoded-value`: the property is not bound to a token. The finding
 *   suggests the token with the same or a close value, when there is one.
 * - `primitive-binding`: the property is bound to a token of the lowest layer,
 *   such as `primitive`, although the candidates include tokens of higher
 *   layers. The finding suggests a higher-layer token with the same value.
 *
 * The result scores the share of properties without a finding. It is
 * separate from the accessibility score: token usage is a matter of design
 * system hygiene, not of WCAG.
 *
 * The samples may come from a Figma document or from code; the rules do not
 * depend on the source.
 *
 * @param candidates - Tokens available for the properties, to suggest from.
 */
export function auditUsageSamples(
    samples: readonly UsageSample[],
    candidates: readonly TokenCandidate[],
    options: TokenUsageOptions = {},
): TokenUsageResult {
    const enabled = new Set(options.rules ?? []);
    const runs = (id: string) => enabled.size === 0 || enabled.has(id);
    const matcher = new TokenMatcher(candidates, options);
    const layers = new TokenLayers(options.layers === undefined ? TokenLayers.DEFAULT_ORDER : [...options.layers]);
    const lowest = layers.lowest();

    const findings: AuditFinding[] = [];
    for (const sample of samples) {
        if (sample.binding === undefined) {
            if (runs(HARDCODED_VALUE)) {
                findings.push(hardcodedFinding(sample, matcher.match(sample.property, sample.value)));
            }
        } else if (sample.binding.layer === lowest
            && hasHigherLayerCandidate(candidates, sample.property, lowest, layers)
            && runs(PRIMITIVE_BINDING)) {
            const match = matcher.match(sample.property, sample.value,
                (candidate) => candidate.layer !== undefined && candidate.layer !== lowest && layers.has(candidate.layer));
            findings.push(primitiveFinding(sample, sample.binding.name, lowest, match));
        }
    }
    return { findings, coverage: computeTokenCoverage(samples), score: computeTokenUsageScore(samples.length, findings) };
}

/**
 * Computes the token usage score: `100 × clean / total`, rounded down, where
 * clean properties are those without a finding. Grades follow the audit score.
 *
 * @param total - Number of properties audited.
 * @param findings - Findings of the token usage rules, at most one per property.
 * @returns The score, or `undefined` when nothing was audited.
 */
export function computeTokenUsageScore(total: number, findings: readonly AuditFinding[]): TokenUsageScore | undefined {
    if (total === 0) return undefined;
    const clean = total - new Set(findings.map((finding) => finding.subjectId)).size;
    const score = Math.floor((clean / total) * 100);
    return { score, grade: auditGrade(score), clean, total };
}

/**
 * Counts the samples bound to a token, in total and per property.
 */
export function computeTokenCoverage(samples: readonly UsageSample[]): TokenCoverage {
    const byProperty: Partial<Record<UsageProperty, { total: number; bound: number }>> = {};
    let bound = 0;
    for (const sample of samples) {
        const totals = byProperty[sample.property] ??= { total: 0, bound: 0 };
        totals.total++;
        if (sample.binding !== undefined) {
            totals.bound++;
            bound++;
        }
    }
    return {
        total: samples.length,
        bound,
        percent: samples.length === 0 ? undefined : Math.floor((bound / samples.length) * 100),
        byProperty,
    };
}

/**
 * Formats a property value as shown to the user: `#rrggbb` or `16px`.
 */
export function formatUsageValue(value: UsageValue): string {
    return value.type === "color" ? formatSrgbColor(value.color) : `${formatNumber(value.px)}px`;
}

function hardcodedFinding(sample: UsageSample, match: TokenMatch | undefined): AuditFinding {
    const value = formatUsageValue(sample.value);
    const advice = match === undefined
        ? "no token has this value."
        : `${match.exact ? "use" : "the closest token is"} ${match.candidate.name}.`;
    return {
        id: HARDCODED_VALUE,
        category: "token-usage",
        severity: "warning",
        message: `${sample.label}: ${propertyName(sample)} ${value} is not bound to a token; ${advice}`,
        subjectId: sample.id,
        measurement: value,
        suggestion: toSuggestion(match),
    };
}

function primitiveFinding(sample: UsageSample, name: string, lowest: string, match: TokenMatch | undefined): AuditFinding {
    const advice = match === undefined
        ? "no token of a higher layer has this value."
        : `use ${match.candidate.name}.`;
    return {
        id: PRIMITIVE_BINDING,
        category: "token-usage",
        severity: "warning",
        message: `${sample.label}: ${propertyName(sample)} is bound to the ${lowest} token ${name}; ${advice}`,
        subjectId: sample.id,
        measurement: name,
        suggestion: toSuggestion(match),
    };
}

function toSuggestion(match: TokenMatch | undefined): AuditFinding["suggestion"] {
    return match === undefined ? undefined : { name: match.candidate.name, exact: match.exact };
}

function propertyName(sample: UsageSample): string {
    const label = PROPERTY_LABELS[sample.property];
    return sample.part === undefined ? label : `${label} (${sample.part})`;
}

function hasHigherLayerCandidate(
    candidates: readonly TokenCandidate[],
    property: UsageProperty,
    lowest: string,
    layers: TokenLayers,
): boolean {
    return candidates.some((candidate) => appliesTo(candidate, property)
        && candidate.layer !== undefined
        && candidate.layer !== lowest
        && layers.has(candidate.layer));
}

function appliesTo(candidate: TokenCandidate, property: UsageProperty): boolean {
    return candidate.properties === undefined || candidate.properties.includes(property);
}
