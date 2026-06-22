import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
import type { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import { CheckRunner } from "#/core/check/CheckRunner";
import { CheckScope } from "#/core/check/CheckScope";
import { TokenLayers } from "#/core/check/TokenLayers";
import { validationChecks, lintingChecks, listChecks } from "#/core/check/checks/Checks";
import type { CheckInfo } from "#/core/check/checks/Checks";

/**
 * Reason a requested check id will not run.
 *
 * - {@code "inactive"}: the check exists but its scope is deeper than the
 *   configured scope.
 * - {@code "unknown"}: no check declares that id.
 */
export type CheckSelectionProblem = "inactive" | "unknown";

/**
 * A requested check id that will not run, with the reason.
 */
export interface CheckSelectionWarning {
    /** The requested id, as given in the allow-list. */
    readonly id: string;

    /** Why the id will not run. */
    readonly problem: CheckSelectionProblem;

    /** For {@code "inactive"}, the scope at which the check would run. */
    readonly requiredScope?: CheckScope;
}

/**
 * Options controlling the {@link DtcgChecker} pipeline.
 */
export interface CheckerOptions {
    /** How deep to run. Defaults to {@link CheckScope.VALIDATE}. */
    scope?: CheckScope;

    /**
     * Layer names from lowest to highest, used by architecture checks.
     * Defaults to primitive/semantic/component.
     */
    layers?: string[];

    /**
     * Allow-list of check ids to run. When omitted or empty, all checks for the
     * selected scope run.
     */
    checks?: string[];
}

/**
 * Runs the check pipeline over DTCG token sources, stopping at the first stage
 * that reports errors.
 *
 * The pipeline mirrors the natural dependency between stages: a file must be
 * schema-valid before its model is checked, and model-valid before its
 * architecture is checked. Each stage is gated by {@link CheckScope}.
 */
export class DtcgChecker implements TokenValidator {
    readonly #loader = new DtcgListLoader();
    readonly #scope: CheckScope;
    readonly #layers: TokenLayers;
    readonly #allowList?: string[];

    constructor(options: CheckerOptions = {}) {
        this.#scope = options.scope ?? CheckScope.VALIDATE;
        this.#layers = options.layers !== undefined && options.layers.length > 0
            ? new TokenLayers(options.layers)
            : TokenLayers.default();
        this.#allowList = options.checks;
    }

    /**
     * Runs the pipeline over the sources. Schema problems are returned alone;
     * otherwise model checks run, and architecture checks run only when the
     * model is error-free.
     */
    async validate(sources: string[]): Promise<CheckIssue[]> {
        let list: DtcgList;
        try {
            list = await this.#loader.load(sources);
        } catch (error) {
            if (error instanceof TokenSyntaxError) {
                return error.issues;
            }
            throw error;
        }

        const issues: CheckIssue[] = [];
        if (this.#scope.includes(CheckScope.VALIDATE)) {
            issues.push(...this.#run(validationChecks(), list));
        }
        if (!hasErrors(issues) && this.#scope.includes(CheckScope.LINT)) {
            issues.push(...this.#run(lintingChecks(), list));
        }
        return issues;
    }

    /**
     * Reports requested check ids that will not run under the current scope.
     *
     * A check is inactive when it exists but its scope is deeper than the
     * configured scope, and unknown when no check declares that id. Returns an
     * empty array when no allow-list was given.
     */
    checkSelectionWarnings(): CheckSelectionWarning[] {
        if (this.#allowList === undefined || this.#allowList.length === 0) {
            return [];
        }
        const byId = new Map(listChecks().map((info) => [info.id, info]));
        const warnings: CheckSelectionWarning[] = [];
        for (const id of this.#allowList) {
            const warning = this.#selectionWarning(id, byId.get(id));
            if (warning !== undefined) {
                warnings.push(warning);
            }
        }
        return warnings;
    }

    #selectionWarning(id: string, info: CheckInfo | undefined): CheckSelectionWarning | undefined {
        if (info === undefined) {
            return { id, problem: "unknown" };
        }
        if (!this.#scope.includes(info.scope)) {
            return { id, problem: "inactive", requiredScope: info.scope };
        }
        return undefined;
    }

    #run(checks: Check[], list: DtcgList): CheckIssue[] {
        const selected = this.#select(checks);
        if (selected.length === 0) {
            return [];
        }
        return new CheckRunner(selected, this.#layers).runList(list);
    }

    #select(checks: Check[]): Check[] {
        if (this.#allowList === undefined || this.#allowList.length === 0) {
            return checks;
        }
        const enabled = new Set(this.#allowList);
        return checks.filter((check) => enabled.has(check.id));
    }
}

function hasErrors(issues: CheckIssue[]): boolean {
    return issues.some((issue) => issue.severity === "error");
}
