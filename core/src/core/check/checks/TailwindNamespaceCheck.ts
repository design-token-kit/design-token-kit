import type { CheckContext } from "#/core/check/CheckContext";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import { TokenCheck } from "#/core/check/TokenCheck";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";

/**
 * Warns about unsupported Design Token Kit Tailwind namespace markers.
 */
export class TailwindNamespaceCheck extends TokenCheck {
    readonly id = "bad-tailwind-namespace";
    readonly description = "Unsupported design-token-kit tailwindNamespace extension value.";
    readonly defaultSeverity: IssueSeverity = "warning";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath, _ctx: CheckContext): CheckIssue[] {
        const extension = token.extensions?.["design-token-kit"];
        if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
            return [];
        }

        const tailwindNamespace = (extension as Record<string, unknown>).tailwindNamespace;
        if (tailwindNamespace === undefined || tailwindNamespace === "breakpoint") {
            return [];
        }

        return [{
            id: this.id,
            severity: this.defaultSeverity,
            tokenPath: path,
            message: `${path.toString()}: unsupported design-token-kit.tailwindNamespace "${String(tailwindNamespace)}"; currently only "breakpoint" is supported`,
        }];
    }
}
