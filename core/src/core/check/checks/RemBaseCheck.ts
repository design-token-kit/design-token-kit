import { TokenGroup } from "#/core/model/TokenGroup";
import { DTK_EXTENSION, REM_BASE_EXTENSION } from "#/core/model/RemBaseExtension";
import type { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import type { Check } from "#/core/check/Check";

/**
 * Warns about an unusable Design Token Kit `rem` base declaration.
 *
 * @remarks
 * The base is read from the root group only, and platforms fall back to the
 * default when it is unusable, so an invalid value would otherwise change the
 * output silently.
 */
export class RemBaseCheck implements Check {
    readonly id = "bad-rem-base";
    readonly description = "Unusable design-token-kit remBase extension value.";
    readonly defaultSeverity: IssueSeverity = "warning";

    check(node: TokenGroup | TokenNode<unknown>, path: TokenPath, _ctx: CheckContext): CheckIssue[] {
        if (!(node instanceof TokenGroup) || !path.isRoot()) return [];

        const extension = node.extensions?.[DTK_EXTENSION];
        if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
            return [];
        }

        const remBase = (extension as Record<string, unknown>)[REM_BASE_EXTENSION];
        if (remBase === undefined) return [];
        if (typeof remBase === "number" && Number.isFinite(remBase) && remBase > 0) return [];

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `unusable design-token-kit.${REM_BASE_EXTENSION} ${JSON.stringify(remBase)}; use a positive number`,
        }];
    }
}
