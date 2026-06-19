import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
import type { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import { CheckRunner } from "#/core/check/CheckRunner";
import { TokenLayers } from "#/core/check/TokenLayers";
import { validationChecks, lintingChecks } from "#/core/check/checks/Checks";

/**
 * How deep the {@link DtcgChecker} pipeline runs.
 *
 * - {@code "schema"}: load and schema-validate only.
 * - {@code "validate"}: schema plus model-correctness checks.
 * - {@code "lint"}: schema, model-correctness, and architecture checks.
 */
export type CheckScope = "schema" | "validate" | "lint";

/**
 * Options controlling the {@link DtcgChecker} pipeline.
 */
export interface CheckerOptions {
    /** How deep to run. Defaults to {@code "validate"}. */
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
        this.#scope = options.scope ?? "validate";
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

        if (this.#scope === "schema") {
            return [];
        }

        const modelIssues = this.#run(validationChecks(), list);
        if (this.#scope === "validate" || hasErrors(modelIssues)) {
            return modelIssues;
        }
        return [...modelIssues, ...this.#run(lintingChecks(), list)];
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
