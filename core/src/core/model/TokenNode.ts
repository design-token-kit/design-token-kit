import { TokenReference } from "#/core/model/TokenReference";
import { TokenType } from "#/core/model/TokenType";

/**
 * Base class for all DTCG token nodes.
 *
 * A token node holds either a direct value (`$value`) or an alias to another token (`$ref`).
 * The `$type` field is inherited from the containing group when not explicitly set.
 * Alias tokens without an explicit or inherited `$type` have `type = undefined`.
 *
 * @see https://tr.designtokens.org/format/#design-token
 */
export abstract class TokenNode<T> {
    readonly #type: TokenType | undefined;
    readonly #value: T | TokenReference;
    readonly description: string | undefined;
    readonly deprecated: boolean | string | undefined;
    readonly extensions: Record<string, unknown> | undefined;

    protected constructor(
        type: TokenType | undefined,
        value: T | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        this.#type = type;
        this.#value = value;
        this.description = description;
        this.deprecated = deprecated;
        this.extensions = extensions;
    }

    /**
     * The token's DTCG type, or `undefined` for alias tokens without an explicit
     * or inherited `$type`.
     */
    get type(): TokenType | undefined {
        return this.#type;
    }

    /**
     * The token's value, or a {@link TokenReference} when this token is an alias.
     *
     * @see https://tr.designtokens.org/format/#aliases-references
     */
    get value(): T | TokenReference {
        return this.#value;
    }

    /** Returns true when this token is an alias to another token. */
    isAlias(): boolean {
        return this.#value instanceof TokenReference;
    }
}
