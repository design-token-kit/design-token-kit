import { TokenFormat } from "#/core/formats/TokenFormat";

import type { FormatDescriptor } from "#/core/formats/FormatDescriptor";
import { lastSegmentOf } from "#/utils/filePath";

/**
 * The token formats that can be read.
 *
 * Registration order is detection order: {@link detect} returns the first
 * descriptor that claims the content, so a permissive format must come last.
 */
export class FormatRegistry {
    readonly #descriptors: readonly FormatDescriptor[];
    readonly #byFormat: ReadonlyMap<TokenFormat, FormatDescriptor>;

    constructor(descriptors: readonly FormatDescriptor[]) {
        this.#descriptors = descriptors;
        this.#byFormat = new Map(descriptors.map((it) => [it.format, it]));
    }

    /**
     * Returns the descriptor for the format, or {@code undefined} when the
     * format cannot be read.
     *
     * Output-only formats such as CSS or Android have no descriptor: they are
     * generated, never parsed.
     */
    find(format: TokenFormat): FormatDescriptor | undefined {
        return this.#byFormat.get(format);
    }

    /**
     * Returns the descriptor for the format.
     *
     * @throws when the format cannot be read, naming the ones that can.
     */
    get(format: TokenFormat): FormatDescriptor {
        const descriptor = this.find(format);
        if (descriptor === undefined) {
            throw new Error(
                `Format "${format}" cannot be read as tokens. Readable formats: ${this.formats().join(", ")}.`,
            );
        }
        return descriptor;
    }

    /**
     * Returns the descriptor whose format the content looks like.
     *
     * Formats are tried in registration order; content no format claims - and
     * empty content - falls to the format that accepts anything.
     *
     * @param fileName - When given, breaks a tie the content alone cannot:
     *   DESIGN.md and HRDT YAML both open with {@code ---}.
     */
    detect(content: string, fileName?: string): FormatDescriptor {
        const trimmed = content.trimStart();

        if (fileName !== undefined && trimmed.startsWith("---")) {
            const byName = this.detectByFileName(fileName);
            if (byName !== undefined) {
                return byName;
            }
        }

        // The last descriptor accepts anything, so the search always lands.
        return this.#descriptors.find((it) => it.detect(trimmed)) ?? this.fallback();
    }

    /**
     * Returns the descriptor whose suffix the file name ends with, or
     * {@code undefined} when no format claims it.
     *
     * The longest matching suffix wins, so {@code tokens.design.md} resolves to
     * DESIGN.md rather than to whichever format merely claims {@code .md}.
     *
     * @param fileName - File name or path; only its last segment is considered.
     */
    detectByFileName(fileName: string): FormatDescriptor | undefined {
        const name = lastSegmentOf(fileName).toLowerCase();
        let match: FormatDescriptor | undefined;
        let matched = 0;

        for (const descriptor of this.#descriptors) {
            for (const suffix of descriptor.suffixes) {
                if (suffix.length > matched && name.length > suffix.length && name.endsWith(suffix)) {
                    match = descriptor;
                    matched = suffix.length;
                }
            }
        }

        return match;
    }

    /**
     * Returns every readable format, in registration order.
     */
    formats(): TokenFormat[] {
        return this.#descriptors.map((it) => it.format);
    }

    /**
     * Returns the descriptor that claims content no other format recognises -
     * the last one registered.
     *
     * @throws when the registry is empty.
     */
    fallback(): FormatDescriptor {
        const last = this.#descriptors.at(-1);
        if (last === undefined) {
            throw new Error("The format registry is empty.");
        }
        return last;
    }

    /**
     * Returns every descriptor, in registration order.
     */
    descriptors(): readonly FormatDescriptor[] {
        return this.#descriptors;
    }
}
