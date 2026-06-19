import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import type { CheckContext } from "#/core/check/CheckContext";

/**
 * Reports problems with references, on both token values and group `$extends`.
 *
 * Follows each alias chain one hop at a time, emitting a diagnostic when a
 * reference points to a missing target, to a group instead of a token, forms a
 * cycle, or resolves to a deprecated token.
 */
export class ReferenceCheck implements Check {
    readonly id = "bad-reference";
    readonly defaultSeverity: IssueSeverity = "error";

    check(node: TokenGroup | TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        const issues: CheckIssue[] = [];
        const visiting = new Set<string>([path.toString()]);

        if (node instanceof TokenGroup) {
            if (node.extends instanceof TokenReference) {
                this.#checkRef(node.extends, path, ctx, visiting, issues);
            }
            return issues;
        }

        const value = node.value;
        if (value instanceof TokenReference) {
            this.#checkRef(value, path, ctx, visiting, issues);
            return issues;
        }

        ctx.walkValue(node, (leaf) => {
            if (leaf.kind === "ref") {
                this.#checkRef(leaf.value as TokenReference, path, ctx, visiting, issues);
            }
        });
        return issues;
    }

    #checkRef(ref: TokenReference, tokenPath: TokenPath, ctx: CheckContext, visiting: Set<string>, issues: CheckIssue[]): void {
        const target = ctx.resolve(ref);
        if (target === undefined) {
            issues.push(this.#issue("bad-reference", "error", tokenPath, `references {${ref.value}} which does not exist`));
            return;
        }

        if (target.node instanceof TokenGroup) {
            issues.push(this.#issue("ref-to-group", "error", tokenPath, `references {${ref.value}} which is a group, not a token`));
            return;
        }

        if (visiting.has(ref.value)) {
            issues.push(this.#issue("circular-reference", "error", tokenPath, `circular reference: {${ref.value}}`));
            return;
        }

        if (target.node.value instanceof TokenReference) {
            visiting.add(ref.value);
            this.#checkRef(target.node.value, ref.path, ctx, visiting, issues);
            visiting.delete(ref.value);
        }

        if (target.node.deprecated) {
            issues.push(this.#issue("deprecated-reference", "warning", tokenPath, `references deprecated token {${ref.value}}`));
        }
    }

    #issue(id: string, severity: IssueSeverity, tokenPath: TokenPath, message: string): CheckIssue {
        return { id, severity, tokenPath, message };
    }
}
