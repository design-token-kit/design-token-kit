import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { TokenType } from "#/core/model/TokenType";

/**
 * A named container for tokens and nested groups.
 *
 * Groups may declare a `$type` that is inherited by all descendant tokens
 * unless overridden at a lower level. Groups may also extend another group
 * via `$extends`.
 *
 * @see https://tr.designtokens.org/format/#groups
 */
export class TokenGroup {
    readonly #children: Map<string, TokenGroup | TokenNode<unknown>>;
    /** Inherited token type for descendant tokens that do not declare their own `$type`. */
    readonly type: TokenType | undefined;
    readonly description: string | undefined;
    readonly deprecated: boolean | string | undefined;
    readonly extensions: Record<string, unknown> | undefined;
    /** Reference to the group this group extends, if any. */
    readonly extends: TokenReference | string | undefined;
    /**
     * Optional root token for this group. Provides a base value while
     * allowing for variants via nested tokens.
     *
     * @see https://tr.designtokens.org/format/#groups
     */
    readonly root: TokenNode<unknown> | undefined;

    constructor(options: {
        type?: TokenType;
        description?: string;
        deprecated?: boolean | string;
        extensions?: Record<string, unknown>;
        extends?: TokenReference | string;
        root?: TokenNode<unknown>;
        children?: Map<string, TokenGroup | TokenNode<unknown>>;
    } = {}) {
        this.type = options.type;
        this.description = options.description;
        this.deprecated = options.deprecated;
        this.extensions = options.extensions;
        this.extends = options.extends;
        this.root = options.root;
        this.#children = options.children ?? new Map();
    }

    /** Returns the child token or group with the given name, or undefined. */
    get(name: string): TokenGroup | TokenNode<unknown> | undefined {
        return this.#children.get(name);
    }

    /** Returns all child names in insertion order. */
    keys(): IterableIterator<string> {
        return this.#children.keys();
    }

    /** Returns all child entries as [name, node] pairs in insertion order. */
    entries(): IterableIterator<[string, TokenGroup | TokenNode<unknown>]> {
        return this.#children.entries();
    }

    /** Returns true if this group contains a child with the given name. */
    has(name: string): boolean {
        return this.#children.has(name);
    }

    get size(): number {
        return this.#children.size;
    }
}
