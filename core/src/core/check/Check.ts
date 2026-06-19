import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";

/**
 * A single check applied to every node during the tree traversal.
 *
 * A check inspects one node at a time and returns the diagnostics found for it.
 * The node is a group or a token; checks that only care about tokens extend
 * {@link TokenCheck} instead of implementing this directly.
 */
export interface Check {
    /**
     * Check identifier, e.g. {@code "layer-reference"}.
     */
    readonly id: string;

    /**
     * Severity applied to issues this check emits.
     */
    readonly defaultSeverity: IssueSeverity;

    /**
     * Checks a single node.
     *
     * @param node - The group or token being checked.
     * @param path - The node's path.
     * @param ctx - The shared check context.
     * @returns Issues found for this node (may be empty).
     */
    check(node: TokenGroup | TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[];
}
