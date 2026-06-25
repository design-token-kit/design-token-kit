import { TokenGroup, type NodeVisitor } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";

/**
 * The root of a DTCG token document, corresponding to a single `.json` file.
 *
 * @see https://tr.designtokens.org/format/#file-format
 */
export class Dtcg {
    readonly #root: TokenGroup;

    /**
     * The origin of this token document.
     *
     * Can be a file path ({@code "tokens.json"}), a URL, or
     * {@code "-"} for stdin.
     * Used in validation diagnostics as the {@code sourcePath}.
     */
    readonly source?: string;

    constructor(root: TokenGroup, source?: string) {
        this.#root = root;
        this.source = source;
    }

    /**
     * The root group of the document.
     */
    get root(): TokenGroup {
        return this.#root;
    }

    /**
     * Returns the top-level child token or group with the given name,
     * or undefined.
     */
    get(name: string): TokenGroup | TokenNode<unknown> | undefined {
        return this.#root.get(name);
    }

    /**
     * Returns all top-level child names in insertion order.
     */
    keys(): IterableIterator<string> {
        return this.#root.keys();
    }

    /** Returns all top-level child entries as [name, node] pairs in insertion order. */
    entries(): IterableIterator<[string, TokenGroup | TokenNode<unknown>]> {
        return this.#root.entries();
    }

    /**
     * Walks the whole document depth-first in pre-order, invoking {@link visit}
     * for the root group first, then for every descendant group and token with
     * its path.
     *
     * @param visit - Callback invoked for every visited node.
     */
    walk(visit: NodeVisitor): void {
        this.#root.walk(visit, TokenPath.root());
    }

    get size(): number {
        return this.#root.size;
    }

    /**
     * Resolves a single reference to its defining node and canonical dotted path.
     *
     * This is a public, read-only wrapper around the internal resolver, intended
     * for tooling (e.g. lint rules) that needs to follow references
     * without re-implementing path resolution.
     * It does not follow alias chains.
     * It resolves the reference one hop, to whatever node the path points at.
     *
     * @param ref - The reference to resolve.
     * @param base - Optional base document used as fallback when resolving against
     *   a theme.
     * @returns The target node and its dotted path, or undefined when the path
     *   does not resolve.
     */
    resolveRef(ref: TokenReference, base?: Dtcg): { node: TokenGroup | TokenNode<unknown>; path: TokenPath } | undefined {
        const node = this.#resolveRef(ref, base);
        return node === undefined ? undefined : { node, path: ref.path };
    }

    /**
     * Follows an alias chain to its end node, applying the theme-to-base
     * fallback.
     *
     * Stops and returns undefined when the chain is broken or cyclic.
     *
     * @param ref - The reference whose chain is followed.
     * @param base - Optional base document used as fallback when resolving
     *   against a theme.
     * @returns The node at the end of the chain, or undefined.
     */
    resolveChain(ref: TokenReference, base?: Dtcg): TokenGroup | TokenNode<unknown> | undefined {
        return this.#resolveChain(ref, new Set(), base);
    }

    #resolveRef(ref: TokenReference, base?: Dtcg): TokenGroup | TokenNode<unknown> | undefined {
        const parts = ref.path.segments();
        let node: TokenGroup | TokenNode<unknown> | undefined = this.#root.get(parts[0]);
        if (node === undefined && base !== undefined) {
            return base.#resolveRef(ref);
        }
        for (let i = 1; i < parts.length; i++) {
            if (!(node instanceof TokenGroup)) return undefined;
            node = node.get(parts[i]);
            if (node === undefined && base !== undefined) {
                return base.#resolveRef(ref);
            }
        }
        return node;
    }

    #resolveChain(ref: TokenReference, visited = new Set<string>(), base?: Dtcg): TokenGroup | TokenNode<unknown> | undefined {
        const target = this.#resolveRef(ref, base);
        if (!(target instanceof TokenNode)) return target;
        if (target.value instanceof TokenReference) {
            if (visited.has(ref.value)) return undefined;
            visited.add(ref.value);
            return this.#resolveChain(target.value, visited, base);
        }
        return target;
    }
}
