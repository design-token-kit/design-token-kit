import { TokenPath } from "#/core/model/TokenPath";

/**
 * A reference to another token or a property of a token value.
 *
 * References are not resolved at model level - resolution is the responsibility
 * of the consumer (resolver, converter, etc.).
 *
 * @see https://tr.designtokens.org/format/#aliases-references
 */
export class TokenReference {
    /** Curly-brace notation with a non-empty, brace-free path inside. */
    static readonly #NOTATION = /^\{[^{}]+\}$/;
    static readonly #JSON_POINTER = /^#\//;

    readonly #aliasPath: TokenPath | undefined;
    readonly #jsonPointer: string | undefined;
    readonly #kind: TokenReferenceKind;

    /**
     * Creates a reference from a token path or JSON Pointer.
     *
     * @param value - token path without braces or a JSON Pointer.
     * @param kind - reference kind. Curly-brace aliases use the default kind.
     */
    constructor(value: string | TokenPath, kind: TokenReferenceKind = "alias") {
        this.#kind = kind;
        this.#aliasPath = kind === "alias"
            ? value instanceof TokenPath ? value : TokenPath.parse(value)
            : undefined;
        this.#jsonPointer = kind === "alias" ? undefined : String(value);
    }

    private static fromPointer(pointer: string): TokenReference {
        return new TokenReference(pointer, "property");
    }

    private static fromTokenPointer(pointer: string): TokenReference {
        return new TokenReference(pointer, "token");
    }

    /**
     * Returns true when the value is written in curly-brace notation,
     * e.g. `{color.base.red}`.
     */
    static isNotation(value: unknown): value is string {
        return typeof value === "string" && TokenReference.#NOTATION.test(value);
    }

    /**
     * Returns true when the value is a DTCG JSON Pointer property reference.
     */
    static isJsonPointer(value: unknown): value is string {
        return typeof value === "string" && TokenReference.#JSON_POINTER.test(value);
    }

    /**
     * Parses curly-brace notation or a property-level JSON Pointer reference.
     *
     * @returns the reference, or {@code undefined} when the value is not
     *   written in curly-brace notation.
     */
    static parse(value: unknown): TokenReference | undefined {
        if (TokenReference.isNotation(value)) return new TokenReference(value.slice(1, -1));
        if (!isJsonPointerReference(value)) return undefined;
        return TokenReference.fromPointer(value.$ref);
    }

    /**
     * Parses a token-level reference, which can use curly-brace notation or a JSON Pointer.
     */
    static parseTokenReference(value: unknown): TokenReference | undefined {
        if (TokenReference.isNotation(value)) return new TokenReference(value.slice(1, -1));
        if (!TokenReference.isJsonPointer(value)) return undefined;
        return hasNestedValueProperty(value)
            ? TokenReference.fromPointer(value)
            : TokenReference.fromTokenPointer(value);
    }

    /** Token path or JSON Pointer without its enclosing reference object. */
    get value(): string {
        return this.#aliasPath?.toString() ?? this.#jsonPointer!;
    }

    /** Whether this is a JSON Pointer reference to a value property. */
    get isPropertyReference(): boolean {
        return this.#kind === "property";
    }

    /** Whether this is a token-level JSON Pointer reference. */
    get isTokenReference(): boolean {
        return this.#kind === "token";
    }

    /** The reference's discriminant. */
    get kind(): TokenReferenceKind {
        return this.#kind;
    }

    /** The referenced token path for a curly-brace alias. */
    get path(): TokenPath {
        if (this.#aliasPath === undefined) {
            throw new Error("A JSON Pointer reference does not address a token path.");
        }
        return this.#aliasPath;
    }

    /** The JSON Pointer for a property-level or token-level reference. */
    get pointer(): string | undefined {
        return this.#jsonPointer;
    }

    /** Serializes to canonical curly-brace notation or a JSON Pointer. */
    toString(): string {
        return this.#aliasPath === undefined ? this.#jsonPointer! : `{${this.#aliasPath.toString()}}`;
    }
}

export type TokenReferenceKind = "alias" | "property" | "token";

function isJsonPointerReference(value: unknown): value is { $ref: string } {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return entries.length === 1 && TokenReference.isJsonPointer((value as { $ref?: unknown }).$ref);
}

function hasNestedValueProperty(pointer: string): boolean {
    try {
        const segments = pointer.slice(2).split("/").map((segment) =>
            decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~"),
        );
        const valueIndex = segments.indexOf("$value");
        return valueIndex >= 0 && valueIndex < segments.length - 1;
    } catch {
        return false;
    }
}
