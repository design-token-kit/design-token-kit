import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenCheck } from "#/core/check/TokenCheck";

/**
 * Enforces that raw (non-reference) values are defined only at the lowest layer.
 *
 * Only the lowest configured layer (e.g. {@code primitive}) may define raw
 * values. A token at any higher layer (semantic, component) that carries a raw
 * value instead of a reference is a violation.
 */
export class RawValueUsageCheck extends TokenCheck {
    readonly id = "raw-value-usage";
    readonly description = "Raw (non-reference) value defined above the lowest layer.";
    readonly defaultSeverity: IssueSeverity = "error";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        const layer = ctx.layers.layerOf(path);
        if (layer === undefined || layer === ctx.layers.lowest()) return [];

        let hasRawValue = false;
        ctx.walkValue(token, (leaf) => {
            if (leaf.kind === "raw") hasRawValue = true;
        });
        if (!hasRawValue) return [];

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `${path.toString()} (${layer}) defines a raw value; only ${ctx.layers.lowest()} tokens may define raw values, others must reference`,
        }];
    }
}
