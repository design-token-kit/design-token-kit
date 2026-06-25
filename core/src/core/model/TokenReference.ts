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
    readonly #path: TokenPath;

    /** @param value - token path without curly braces, e.g. `color.base.red` */
    constructor(value: string | TokenPath) {
        this.#path = value instanceof TokenPath ? value : TokenPath.parse(value);
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
