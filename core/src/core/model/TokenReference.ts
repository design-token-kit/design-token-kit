/**
 * A reference to another token using curly-brace notation, e.g. `{color.base.red}`.
 *
 * References are not resolved at model level - resolution is the responsibility
 * of the consumer (resolver, converter, etc.).
 *
 * @see https://tr.designtokens.org/format/#aliases-references
 */
export class TokenReference {
    readonly #value: string;

    /** @param value - token path without curly braces, e.g. `color.base.red` */
    constructor(value: string) {
        this.#value = value;
    }

    /** Token path without curly braces, e.g. `color.base.red`. */
    get value(): string {
        return this.#value;
    }

    /** Serializes to canonical curly-brace notation, e.g. `{color.base.red}`. */
    toString(): string {
        return `{${this.#value}}`;
    }
}
