import { TokenGroup } from "#/core/model/TokenGroup";
import type { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import type { Check } from "#/core/check/Check";

/**
 * Warns about named groups that do not contain tokens or child groups.
 */
export class EmptyGroupCheck implements Check {
    readonly id = "empty-group";
    readonly description = "Group has no tokens or child groups.";
    readonly defaultSeverity: IssueSeverity = "warning";

    check(node: TokenGroup | TokenNode<unknown>, path: TokenPath, _ctx: CheckContext): CheckIssue[] {
        if (!(node instanceof TokenGroup) || path.isRoot()) return [];
        if (node.size > 0 || node.root !== undefined) return [];

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `${path.toString()}: group has no tokens or child groups`,
        }];
    }
}
