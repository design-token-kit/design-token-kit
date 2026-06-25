import type { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenCheck } from "#/core/check/TokenCheck";

/**
 * Warns about tokens that do not define a non-empty `$description`.
 */
export class MissingDescriptionCheck extends TokenCheck {
    readonly id = "missing-description";
    readonly description = "Token has no $description.";
    readonly defaultSeverity: IssueSeverity = "warning";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath, _ctx: CheckContext): CheckIssue[] {
        if (token.description !== undefined && token.description.trim().length > 0) return [];

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `${path.toString()}: token has no $description`,
        }];
    }
}
