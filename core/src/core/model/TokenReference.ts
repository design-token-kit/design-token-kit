import { TokenPath } from "#/core/model/TokenPath";

/**
 * A reference to another token using curly-brace notation, e.g. `{color.base.red}`.
 *
 * References are not resolved at model level - resolution is the responsibility
 * of the consumer (resolver, converter, etc.).
 *
 * @see https://tr.designtokens.org/format/#aliases-references
 */
export class TokenReference {
    /** Curly-brace notation with a non-empty, brace-free path inside. */
    static readonly #NOTATION = /^\{[^{}]+\}$/;

    readonly #path: TokenPath;

    /** @param value - token path without curly braces, e.g. `color.base.red` */
    constructor(value: string | TokenPath) {
        this.#path = value instanceof TokenPath ? value : TokenPath.parse(value);
    }

    /**
     * Returns true when the value is written in curly-brace notation,
     * e.g. `{color.base.red}`.
     */
    static isNotation(value: unknown): value is string {
        return typeof value === "string" && TokenReference.#NOTATION.test(value);
    }

    /**
     * Parses curly-brace notation into a reference, e.g. `{color.base.red}`.
     *
     * @returns the reference, or {@code undefined} when the value is not
     *   written in curly-brace notation.
     */
    static parse(value: unknown): TokenReference | undefined {
        return TokenReference.isNotation(value)
            ? new TokenReference(value.slice(1, -1))
            : undefined;
    }

    /** Token path without curly braces, e.g. `color.base.red`. */
    get value(): string {
        return this.#path.toString();
    }

    /** The referenced token path as a structured value object. */
    get path(): TokenPath {
        return this.#path;
    }

    /** Serializes to canonical curly-brace notation, e.g. `{color.base.red}`. */
    toString(): string {
        return `{${this.#path.toString()}}`;
    }
}
