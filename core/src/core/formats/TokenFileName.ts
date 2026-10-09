import type { FormatRegistry } from "#/core/formats/FormatRegistry";
import { lastSegmentOf } from "#/utils/filePath";
import type { FormatDescriptor } from "#/core/formats/FormatDescriptor";
import type { TokenFormat } from "#/core/formats/TokenFormat";

/**
 * A token file name, read as `<role>[.theme].<format>`.
 *
 * @remarks
 * The trailing part is a suffix some format declares, either a bare extension
 * or a qualified form naming the format:
 *
 * ```
 * tokens.json            -> role tokens,   base document, DTCG
 * tokens.dark.json       -> role tokens,   theme dark,    DTCG
 * sample.dtcg.json       -> role sample,   base document, DTCG
 * sample.dark.design.md  -> role sample,   theme dark,    DESIGN.md
 * ```
 *
 * The format segment is optional: an extension already names the format while
 * only one format claims it. It becomes necessary once two formats share one
 * extension, and examples spell it out to show which file is which.
 *
 * Whatever sits between the role and the suffix is the theme - including a
 * format name no descriptor declares, which is a theme like any other word.
 */
export class TokenFileName {
    readonly #descriptor?: FormatDescriptor;
    readonly #role: string;
    readonly #theme?: string;

    private constructor(descriptor: FormatDescriptor | undefined, role: string, theme: string | undefined) {
        this.#descriptor = descriptor;
        this.#role = role;
        this.#theme = theme;
    }

    /**
     * Reads a file name or path; only its last segment is considered.
     *
     * A name no format claims keeps its whole last segment as the role and
     * carries no theme, because nothing marks where the theme would end.
     *
     * @param formats - The formats whose suffixes end a name. Passed in rather
     * than taken from the full registry, so a caller reading one format does
     * not pull in the readers of the others.
     */
    static parse(fileName: string, formats: FormatRegistry): TokenFileName {
        const name = lastSegmentOf(fileName);
        const descriptor = formats.detectByFileName(name);
        if (descriptor === undefined) {
            return new TokenFileName(undefined, name, undefined);
        }

        const stem = name.slice(0, name.length - suffixLength(descriptor, name));
        const [role, ...theme] = stem.split(".");
        return new TokenFileName(descriptor, role, theme.length > 0 ? theme.join(".") : undefined);
    }

    /**
     * The format the name declares, {@code undefined} when no format claims the
     * name. This is a hint from the name alone - the content decides.
     */
    get format(): TokenFormat | undefined {
        return this.#descriptor?.format;
    }

    /**
     * What the file holds: {@code tokens}, {@code showcase}, {@code invalid}.
     */
    get role(): string {
        return this.#role;
    }

    /**
     * The theme the file overrides, {@code undefined} for the base document.
     */
    get theme(): string | undefined {
        return this.#theme;
    }
}

/**
 * Returns the length of the longest suffix of the descriptor the name ends
 * with - the one {@link FormatRegistry.detectByFileName} matched on.
 */
function suffixLength(descriptor: FormatDescriptor, name: string): number {
    const lower = name.toLowerCase();
    return descriptor.suffixes
        .filter((suffix) => lower.endsWith(suffix))
        .reduce((longest, suffix) => Math.max(longest, suffix.length), 0);
}
