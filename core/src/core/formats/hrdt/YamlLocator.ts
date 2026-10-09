import type { Document, LineCounter, Node } from "yaml";
import type { SourceLocator, SourcePosition } from "#/core/formats/support/SourceLocation";

/**
 * Locates values in YAML source text.
 *
 * The YAML parser keeps a character range on every node, and the line counter
 * turns an offset into a line and column, so a diagnostic can point at the
 * exact value that caused it.
 */
export class YamlLocator implements SourceLocator {
    readonly #doc: Document;
    readonly #lineCounter: LineCounter;

    constructor(doc: Document, lineCounter: LineCounter) {
        this.#doc = doc;
        this.#lineCounter = lineCounter;
    }

    of(path: readonly string[]): SourcePosition | undefined {
        const node = path.length === 0 ? this.#doc.contents : this.#doc.getIn(path, true);
        return this.#positionOf(node);
    }

    /** Position of the document root, used when the document itself is wrong. */
    ofRoot(): SourcePosition | undefined {
        return this.#positionOf(this.#doc.contents);
    }

    /** Position of a character offset in the source. */
    at(offset: number): SourcePosition | undefined {
        const pos = this.#lineCounter.linePos(offset);
        return { line: pos.line, column: pos.col };
    }

    #positionOf(node: unknown): SourcePosition | undefined {
        const range = (node as Node | null | undefined)?.range;
        return range === undefined || range === null ? undefined : this.at(range[0]);
    }
}
