/**
 * The location of a token or group within a DTCG tree, e.g. `component.button.bg`.
 */
export class TokenPath {
    readonly #segments: readonly string[];

    private constructor(segments: readonly string[]) {
        this.#segments = [...segments];
    }

    /**
     * Returns the empty root path, which renders to the empty string.
     */
    static root(): TokenPath {
        return new TokenPath([]);
    }

    /**
     * Builds a path from explicit segments.
     * Segments are taken as-is and never split on dots.
     */
    static of(...segments: string[]): TokenPath {
        return new TokenPath(segments);
    }

    /**
     * Parses a dotted string into a path by splitting on the dot separator.
     * An empty string yields the root path.
     */
    static parse(dotted: string): TokenPath {
        return dotted === "" ? TokenPath.root() : new TokenPath(dotted.split("."));
    }

    /**
     * Returns a new path with one segment appended.
     */
    child(segment: string): TokenPath {
        return new TokenPath([...this.#segments, segment]);
    }

    /**
     * Returns the path segments as a read-only array.
     */
    segments(): readonly string[] {
        return [...this.#segments];
    }

    /**
     * Returns the first segment, used for level lookup, or undefined for the root path.
     */
    head(): string | undefined {
        return this.#segments[0];
    }

    /**
     * Returns true when this is the empty root path.
     */
    isRoot(): boolean {
        return this.#segments.length === 0;
    }

    /**
     * Returns true when both paths have the same segments in the same order.
     */
    equals(other: TokenPath): boolean {
        if (this.#segments.length !== other.#segments.length) return false;
        return this.#segments.every((segment, index) => segment === other.#segments[index]);
    }

    /**
     * Returns the dotted form, e.g. `component.button.bg`.
     * The root path renders as the empty string.
     */
    toString(): string {
        return this.#segments.join(".");
    }
}
