import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
import type { CheckContext } from "#/core/check/CheckContext";
import { TokenCheck } from "#/core/check/TokenCheck";
import {
    REFERENCE_SOURCES_EXTENSION,
    REFERENCE_SOURCES_NAMESPACE,
} from "#/core/model/ReferenceSourcesExtension";

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
 * A reference-source extension may provide the original alias layer for a property reference.
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
            const layerReference = toLayerReference(token, ref, ctx);
            const target = ctx.resolve(layerReference);
            if (target === undefined) continue;
            const toLayer = ctx.layers.layerOf(target.path);
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
                targetPath: target.path,
                message: `${path.toString()} (${fromLayer}) references ${layerReference.toString()} (${toLayer}); ${allowedHint}`,
            });
        }
        return issues;
    }
}

function toLayerReference(token: TokenNode<unknown>, reference: TokenReference, ctx: CheckContext): TokenReference {
    if (!reference.isPropertyReference) return reference;

    const source = readReferenceSource(token, reference.pointer);
    if (source === undefined) return reference;

    const sourceReference = TokenReference.parse(source);
    if (sourceReference === undefined || sourceReference.isPropertyReference) return reference;

    const sourceTarget = ctx.resolve(sourceReference);
    if (sourceTarget === undefined || sourceTarget.node instanceof TokenGroup) {
        return reference;
    }

    return sourceReference;
}

function readReferenceSource(token: TokenNode<unknown>, pointer: string | undefined): string | undefined {
    if (pointer === undefined) return undefined;

    const extension = token.extensions?.[REFERENCE_SOURCES_NAMESPACE];
    if (!isRecord(extension)) return undefined;

    const sources = extension[REFERENCE_SOURCES_EXTENSION];
    if (!isRecord(sources)) return undefined;

    const source = sources[pointer];
    return typeof source === "string" ? source : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
