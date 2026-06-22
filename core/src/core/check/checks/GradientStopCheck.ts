import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { GradientStop } from "#/core/model/values/GradientValue";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import { TokenCheck } from "#/core/check/TokenCheck";

/**
 * Reports gradients that repeat a stop position.
 *
 * A gradient is a list of stops; two stops at the same numeric position are
 * ambiguous and flagged.
 */
export class GradientStopCheck extends TokenCheck {
    readonly id = "gradient-duplicate-stop";
    readonly description = "Gradient that repeats a stop position.";
    readonly defaultSeverity: IssueSeverity = "error";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath): CheckIssue[] {
        const value = token.value;
        if (!Array.isArray(value)) return [];

        const issues: CheckIssue[] = [];
        const positions: number[] = [];
        for (const item of value) {
            if (item instanceof GradientStop && typeof item.position === "number") {
                if (positions.includes(item.position)) {
                    issues.push({
                        id: this.id,
                        severity: this.defaultSeverity,
                        tokenPath: path,
                        message: `gradient has duplicate stop position ${item.position}`,
                    });
                } else {
                    positions.push(item.position);
                }
            }
        }
        return issues;
    }
}
