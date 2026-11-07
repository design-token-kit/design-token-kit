import type { AuditFinding, UncheckedSubject } from "#/core/audit/AuditFinding";
import { computeAuditScore, type AuditScore, type AuditScoreWeights } from "#/core/audit/AuditScore";
import { auditTextSamples, listAuditRules, type TextAuditOptions } from "#/core/audit/accessibility/AccessibilityAudit";
import { TokenTextSampler } from "#/core/audit/tokens/TokenTextSampler";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { TokenFormat } from "#/core/formats/TokenFormat";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import type { DtcgList } from "#/core/model/DtcgList";

/**
 * Audits the design quality of token sources.
 *
 * Unlike {@link TokenChecker}, which reports whether tokens are valid and
 * follow the layer architecture, the audit reports whether the design they
 * describe is accessible and readable: text contrast, font sizes and line
 * heights. Only accessibility and readability rules exist so far.
 *
 * Accepts every readable format - DTCG JSON, HRDT YAML and DESIGN.md. The
 * first source is the base token set, the others are themes over it.
 */
export class TokenAuditor {
    readonly #loader: DtcgListLoader;
    readonly #options: AuditorOptions;

    constructor(options: AuditorOptions = {}) {
        this.#loader = new DtcgListLoader(options.schema);
        this.#options = options;
    }

    /**
     * Reads the sources and audits them.
     *
     * @returns The report, or the diagnostics explaining why the sources could
     *   not be read.
     */
    async audit(sources: string[]): Promise<AuditResult> {
        const read = await this.#loader.read(sources, this.#options.inform);
        if (!read.ok) {
            return { ok: false, issues: read.issues };
        }
        return { ok: true, report: this.auditList(read.list), issues: read.issues };
    }

    /**
     * Audits a token set that is already loaded.
     */
    auditList(list: DtcgList): AuditReport {
        const samples = new TokenTextSampler().sample(list);
        const { findings, unchecked } = auditTextSamples(samples, this.#options);
        const sorted = [...findings].sort((a, b) => severityRank(a) - severityRank(b));
        const errors = sorted.filter((finding) => finding.severity === "error").length;
        const score = samples.length === 0 || unchecked.length >= samples.length
            ? undefined
            : computeAuditScore(errors, sorted.length - errors, this.#options.scoreWeights);
        return {
            findings: sorted,
            unchecked,
            sampleCount: samples.length,
            score,
        };
    }

    /**
     * Returns the requested rule ids that no rule declares.
     */
    unknownRules(): string[] {
        const known = new Set(listAuditRules().map((rule) => rule.id));
        return (this.#options.rules ?? []).filter((id) => !known.has(id));
    }
}

function severityRank(finding: AuditFinding): number {
    return finding.severity === "error" ? 0 : 1;
}

/**
 * Options controlling the {@link TokenAuditor}.
 */
export interface AuditorOptions extends TextAuditOptions {
    /**
     * DTCG JSON Schema: a directory path or a built-in schema name. Defaults to
     * the built-in "2025.10" schema.
     */
    readonly schema?: string;

    /**
     * Force all sources to this format instead of auto-detecting from content.
     */
    readonly inform?: TokenFormat;

    /** Points each error and warning take off the score. */
    readonly scoreWeights?: AuditScoreWeights;
}

/**
 * Outcome of auditing token sources: the report, or why the sources could not
 * be read.
 */
export type AuditResult = AuditSuccess | AuditFailure;

/**
 * An audit that read its sources.
 */
export interface AuditSuccess {
    readonly ok: true;

    /** The audit report. */
    readonly report: AuditReport;

    /** Warnings the sources raised without stopping the load. */
    readonly issues: CheckIssue[];
}

/**
 * An audit whose sources could not be read.
 */
export interface AuditFailure {
    readonly ok: false;

    /** Why the sources could not be read; never empty. */
    readonly issues: CheckIssue[];
}

/**
 * What an audit found.
 */
export interface AuditReport {
    /** Problems found, errors first. */
    readonly findings: AuditFinding[];

    /** Subjects the rules could not evaluate; they do not affect the score. */
    readonly unchecked: UncheckedSubject[];

    /** Number of text samples audited: color pairs and typography tokens. */
    readonly sampleCount: number;

    /** Design quality score, undefined when no sample could be checked. */
    readonly score?: AuditScore;
}
