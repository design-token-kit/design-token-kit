import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenCheck } from "#/core/check/TokenCheck";

/**
 * Reports alias tokens whose declared type differs from the token they resolve to.
 *
 * Applies only to tokens with an explicit type that alias another token; the
 * alias chain is followed to its end and its type compared.
 */
export class TypeMismatchCheck extends TokenCheck {
    readonly id = "type-mismatch";
    readonly defaultSeverity: IssueSeverity = "error";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        const value = token.value;
        if (!(value instanceof TokenReference) || token.type === undefined) return [];

        const resolved = ctx.resolveChain(value);
        if (!(resolved instanceof TokenNode) || resolved.type === undefined || resolved.type === token.type) {
            return [];
        }

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `type mismatch: token is "${token.type}" but references "${resolved.type}" token {${value.value}}`,
        }];
    }
}
