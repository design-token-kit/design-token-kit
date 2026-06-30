import { TokenGroup } from "#/core/model/TokenGroup";
import type { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import type { Check } from "#/core/check/Check";

/**
 * Enforces that every named token/group path starts with a configured root layer.
 */
export class RootLayerCheck implements Check {
    readonly id = "root-layer";
    readonly description = "Path must start with a configured root layer.";
    readonly defaultSeverity: IssueSeverity = "error";

    check(_node: TokenGroup | TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        if (path.isRoot() || ctx.layers.layerOf(path) !== undefined) return [];

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `${path.toString()}: path must start with one of: ${ctx.layers.names().join(", ")}`,
        }];
    }
}
