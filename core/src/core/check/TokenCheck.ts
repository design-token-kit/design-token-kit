import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import type { CheckContext } from "#/core/check/CheckContext";

/**
 * Base class for checks that inspect tokens only.
 *
 * Narrows the node to a token and ignores groups, so subclasses implement
 * {@link checkToken} without repeating the group guard.
 */
export abstract class TokenCheck implements Check {
    abstract readonly id: string;

    abstract readonly defaultSeverity: IssueSeverity;

    check(node: TokenGroup | TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        return node instanceof TokenNode ? this.checkToken(node, path, ctx) : [];
    }

    /**
     * Checks a single token.
     *
     * @param token - The token being checked.
     * @param path - The token's path.
     * @param ctx - The shared check context.
     * @returns Issues found for this token (may be empty).
     */
    protected abstract checkToken(token: TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[];
}
