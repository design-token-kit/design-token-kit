import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";
import type { TokenGroup } from "#/core/model/TokenGroup";
import type { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import { walkTokenValue } from "#/core/model/TokenValueWalker";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenLayers } from "#/core/check/TokenLayers";

/**
 * Applies a set of checks to every group and token of a {@link DtcgList},
 * driving the document's own {@link Dtcg.walk} traversal.
 *
 * The base document is checked standalone.
 * Each theme is checked with the base as a resolution fallback.
 * Diagnostics are deduplicated per document: an issue with the same severity,
 * path and message is emitted once.
 */
export class CheckRunner {
    /** The checks applied to every visited node, in order. */
    readonly #checks: readonly Check[];
    /** Layer hierarchy passed to checks that reason about layering. */
    readonly #layers: TokenLayers;

    /**
     * @param checks - Checks to apply to each node.
     * @param layers - Layer hierarchy made available to the checks.
     *   Defaults to the standard primitive/semantic/component order.
     */
    constructor(checks: readonly Check[], layers: TokenLayers = TokenLayers.default()) {
        this.#checks = checks;
        this.#layers = layers;
    }

    /**
     * Runs the checks over a base document and each of its themes.
     *
     * The base is checked standalone; every theme is checked with the base
     * as a reference-resolution fallback.
     *
     * @param list - The base document and its theme overrides.
     * @returns All issues found across the base and themes.
     */
    runList(list: DtcgList): CheckIssue[] {
        const issues: CheckIssue[] = [];
        issues.push(...this.run(list.base));
        for (const theme of list.themes.values()) {
            issues.push(...this.run(theme, list.base));
        }
        return issues;
    }

    /**
     * Runs the checks over a single document.
     *
     * @param doc - The document to check.
     * @param base - Optional base document used as a fallback when resolving
     *   references from a theme.
     * @returns The deduplicated issues found in the document, each tagged with
     *   the document's source path.
     */
    run(doc: Dtcg, base?: Dtcg): CheckIssue[] {
        const ctx = this.#createContext(doc, base);

        const issues: CheckIssue[] = [];
        const seen = new Set<string>();
        doc.walk((node, path) => this.#applyChecks(node, path, ctx, issues, seen));

        return this.#tagSource(issues, doc.source);
    }

    /**
     * Builds the context handed to each check: the layer hierarchy, the value
     * walker, and reference resolvers bound to this document and its base.
     */
    #createContext(doc: Dtcg, base?: Dtcg): CheckContext {
        return {
            layers: this.#layers,
            walkValue: walkTokenValue,
            resolve: (ref) => doc.resolveRef(ref, base),
            resolveChain: (ref) => doc.resolveChain(ref, base),
        };
    }

    /** Applies every check to a single node, collecting their issues. */
    #applyChecks(node: TokenGroup | TokenNode<unknown>, path: TokenPath, ctx: CheckContext, issues: CheckIssue[], seen: Set<string>): void {
        for (const check of this.#checks) {
            for (const issue of check.check(node, path, ctx)) {
                this.#collect(issue, issues, seen);
            }
        }
    }

    /**
     * Adds an issue to the result unless an identical one (same severity, path
     * and message) was already collected, prefixing its path for display.
     */
    #collect(issue: CheckIssue, issues: CheckIssue[], seen: Set<string>): void {
        const path = issue.tokenPath?.toString() ?? "";
        const key = `${issue.severity}:${path}:${issue.message}`;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push(this.#prefixPath(issue, path));
    }

    /**
     * Prefixes the issue message with its token path, unless the path is empty
     * or already present in the message.
     */
    #prefixPath(issue: CheckIssue, path: string): CheckIssue {
        if (path === "" || issue.message.includes(path)) return issue;
        return { ...issue, message: `${path}: ${issue.message}` };
    }

    /**
     * Returns the issues tagged with the document's source path, or the issues
     * unchanged when the source is unknown.
     */
    #tagSource(issues: CheckIssue[], source: string | undefined): CheckIssue[] {
        if (source === undefined) return issues;
        return issues.map((issue) => ({ ...issue, sourcePath: source }));
    }
}
