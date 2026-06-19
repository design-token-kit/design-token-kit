import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import type { LeafVisitor } from "#/core/model/TokenValueWalker";
import { TokenLayers } from "#/core/check/TokenLayers";

/**
 * The target node of a resolved reference together with its path.
 */
export interface ResolvedRef {
    readonly node: TokenGroup | TokenNode<unknown>;
    readonly path: TokenPath;
}

/**
 * The shared context handed to every check while a document is checked.
 *
 * Exposes value walking and reference resolution so checks do not re-implement
 * traversal or path resolution.
 */
export interface CheckContext {
    /**
     * The configured token layers.
     */
    readonly layers: TokenLayers;

    /**
     * Walks a token's value and yields each reference or raw leaf.
     */
    walkValue(token: TokenNode<unknown>, visit: LeafVisitor): void;

    /**
     * Resolves a reference one hop, applying the theme-to-base fallback.
     * Returns undefined when the reference does not resolve.
     */
    resolve(ref: TokenReference): ResolvedRef | undefined;

    /**
     * Follows an alias chain to its end node, applying the theme-to-base
     * fallback. Returns undefined when the chain is broken or cyclic.
     */
    resolveChain(ref: TokenReference): TokenGroup | TokenNode<unknown> | undefined;
}
