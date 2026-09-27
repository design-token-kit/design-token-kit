import { CheckRunner } from "#/core/check/CheckRunner";
import { CheckScope } from "#/core/check/CheckScope";
import { TokenLayers } from "#/core/check/TokenLayers";
import { lintingChecks, validationChecks } from "#/core/check/checks/Checks";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import type { DtcgList } from "#/core/model/DtcgList";
import { TokenStatsCalculator, type TokenStat } from "#/core/stats/TokenStatsCalculator";
import { BrowserTokenDocuments } from "#/browser/BrowserTokenDocuments";
import { BrowserTokenOutputConverter } from "#/browser/BrowserTokenOutputConverter";
import { BrowserTokenValidationError, toBrowserIssue } from "#/browser/BrowserTokenValidationError";
import type {
    BrowserCheckOptions, BrowserOutputFormat, BrowserTokenOutput, BrowserTokenSet,
} from "#/browser/BrowserTokenTypes";

export { BrowserTokenValidationError } from "#/browser/BrowserTokenValidationError";
export type {
    BrowserCheckOptions, BrowserDtcgSchema, BrowserInputFormat, BrowserOutputFormat,
    BrowserTokenDocument, BrowserTokenOutput, BrowserTokenSet,
} from "#/browser/BrowserTokenTypes";

/**
 * Validates, converts, showcases, and measures token content in the browser.
 *
 * This facade coordinates in-memory document loading and platform converters.
 * The UI owns file picking, URL fetching, and downloads.
 *
 * @experimental The browser API may change in minor releases.
 */
export class BrowserTokenToolkit {
    readonly #converter = new BrowserTokenOutputConverter();
    readonly #stats = new TokenStatsCalculator();

    /**
     * Returns diagnostics for the selected check depth and allow-list.
     */
    check(input: BrowserTokenSet, options: BrowserCheckOptions = {}): CheckIssue[] {
        return this.#analyze(input, options).issues;
    }

    /**
     * Converts tokens after all schema and model checks pass.
     *
     * The check scope and allow-list do not disable required validation.
     */
    convert(
        input: BrowserTokenSet,
        format: BrowserOutputFormat,
        options: BrowserCheckOptions = {},
    ): BrowserTokenOutput[] {
        try {
            return this.#converter.convert(this.#validatedList(input, options), format);
        } catch (error) {
            throw toValidationError(error, input.base.source, "conversion");
        }
    }

    /**
     * Calculates statistics after all schema and model checks pass.
     */
    stats(input: BrowserTokenSet, options: BrowserCheckOptions = {}): readonly TokenStat[] {
        try {
            return this.#stats.calculate(this.#validatedList(input, options));
        } catch (error) {
            throw toValidationError(error, input.base.source, "statistics");
        }
    }

    #analyze(input: BrowserTokenSet, options: BrowserCheckOptions): TokenAnalysis {
        const documents = new BrowserTokenDocuments(input);
        const issues: CheckIssue[] = documents.validate(options.schema);
        if (hasErrors(issues) || options.scope === CheckScope.SCHEMA) return { issues };
        try {
            const list: DtcgList = documents.parse();
            issues.push(...checkModel(list, options));
            return { issues, list };
        } catch (error) {
            return { issues: [...issues, toBrowserIssue(error, input.base.source ?? "browser-input")] };
        }
    }

    #validatedList(input: BrowserTokenSet, options: BrowserCheckOptions): DtcgList {
        const { issues, list }: TokenAnalysis = this.#analyze(input, {
            ...options, scope: CheckScope.VALIDATE, checks: undefined,
        });
        if (list === undefined || hasErrors(issues)) throw new BrowserTokenValidationError(issues);
        return list;
    }
}

interface TokenAnalysis {
    readonly issues: CheckIssue[];
    readonly list?: DtcgList;
}

function checkModel(list: DtcgList, options: BrowserCheckOptions): CheckIssue[] {
    const scope: CheckScope = options.scope ?? CheckScope.VALIDATE;
    const layers: TokenLayers = options.layers?.length ? new TokenLayers([...options.layers]) : TokenLayers.default();
    const issues: CheckIssue[] = scope.includes(CheckScope.VALIDATE)
        ? runChecks(validationChecks(), list, layers, options.checks) : [];
    if (!hasErrors(issues) && scope.includes(CheckScope.LINT)) {
        issues.push(...runChecks(lintingChecks(), list, layers, options.checks));
    }
    return issues;
}

function runChecks(
    checks: readonly Check[],
    list: DtcgList,
    layers: TokenLayers,
    selectedIds?: readonly string[],
): CheckIssue[] {
    const selected: readonly Check[] = selectedIds?.length
        ? checks.filter((check) => selectedIds.includes(check.id)) : checks;
    return new CheckRunner(selected, layers).runList(list);
}

function hasErrors(issues: readonly CheckIssue[]): boolean {
    return issues.some((issue) => issue.severity === "error");
}

// Caught JavaScript failures may have any type, including non-Error values.
function toValidationError(error: unknown, source: string | undefined, issueId: string): BrowserTokenValidationError {
    if (error instanceof BrowserTokenValidationError) return error;
    return new BrowserTokenValidationError(
        [toBrowserIssue(error, source ?? "browser-input", issueId)], { cause: error },
    );
}
