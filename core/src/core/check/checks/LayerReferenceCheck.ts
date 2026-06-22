import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenCheck } from "#/core/check/TokenCheck";

/**
 * Enforces the allowed cross-layer reference edges.
 *
 * A reference is allowed only from a layer to its adjacent lower layer
 * (e.g. {@code component -> semantic}, {@code semantic -> primitive}). Any other
 * cross-section reference - skipping a layer, referencing upward, or referencing
 * within the same layer - is a violation.
 *
 * The target layer is taken from the reference's direct address (the first
 * segment of the referenced path), not from a resolved alias chain.
 */
export class LayerReferenceCheck extends TokenCheck {
    readonly id = "layer-reference";
    readonly description = "Cross-layer reference that is not from a layer to its adjacent lower layer.";
    readonly defaultSeverity: IssueSeverity = "error";

    protected checkToken(token: TokenNode<unknown>, path: TokenPath, ctx: CheckContext): CheckIssue[] {
        const fromLayer = ctx.layers.layerOf(path);
        if (fromLayer === undefined) return [];

        const refs: TokenReference[] = [];
        ctx.walkValue(token, (leaf) => {
            if (leaf.kind === "ref") refs.push(leaf.value as TokenReference);
        });

        const issues: CheckIssue[] = [];
        for (const ref of refs) {
            const toLayer = ctx.layers.layerOf(ref.path);
            if (toLayer === undefined) continue;
            if (ctx.layers.isAllowedEdge(fromLayer, toLayer)) continue;

            const allowed = ctx.layers.names()[ctx.layers.indexOf(fromLayer) - 1];
            const allowedHint = allowed === undefined
                ? `${fromLayer} tokens may not reference other layers`
                : `allowed only ${fromLayer} -> ${allowed}`;
            issues.push({
                id: this.id,
                severity: this.defaultSeverity,
                tokenPath: path,
                message: `${path.toString()} (${fromLayer}) references {${ref.value}} (${toLayer}); ${allowedHint}`,
            });
        }
        return issues;
    }
}
