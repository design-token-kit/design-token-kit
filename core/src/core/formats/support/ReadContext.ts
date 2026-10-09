import { TokenPath } from "#/core/model/TokenPath";
import type { IssueCollector } from "#/core/formats/support/IssueCollector";
import type { SourceLocator } from "#/core/formats/support/SourceLocation";
import { TokenReadError } from "#/core/formats/support/TokenReadError";

/**
 * Tracks where a reader currently is while walking a source, so a diagnostic
 * can name the token it belongs to and point at its position.
 *
 * A context is immutable: {@link enter} returns a context for the child rather
 * than mutating the current one, which keeps the path correct no matter how the
 * reader recurses.
 */
export class ReadContext {
    readonly #issues: IssueCollector;
    readonly #locator?: SourceLocator;
    readonly #path: readonly string[];

    constructor(issues: IssueCollector, locator?: SourceLocator, path: readonly string[] = []) {
        this.#issues = issues;
        this.#locator = locator;
        this.#path = path;
    }

    /**
     * Returns the context for a child of the current node.
     */
    enter(segment: string): ReadContext {
        return new ReadContext(this.#issues, this.#locator, [...this.#path, segment]);
    }

    /**
     * Records a diagnostic for the current node.
     */
    report(id: string, message: string, raw?: unknown): void {
        this.#issues.add(id, message, {
            tokenPath: this.#path.length > 0 ? TokenPath.of(...this.#path) : undefined,
            position: this.#locator?.of(this.#path),
            raw,
        });
    }
}

/**
 * Reads one token, turning a {@link TokenReadError} into a diagnostic instead
 * of letting it escape.
 *
 * The value parsers throw on the first problem they meet, which is the right
 * granularity for a single token: the token is either understood or not. This
 * confines that failure to the token, so the tokens after it are still read and
 * the author sees every broken one at once.
 *
 * Only a read error is confined. Anything else is a programming error, and
 * reporting it as a broken token would hide it behind the author's data.
 *
 * @param ctx - Context of the token, naming where the diagnostic belongs.
 * @param read - Parses the token.
 * @returns The token, or {@code undefined} when it could not be read.
 */
export function readToken<T>(ctx: ReadContext, read: () => T): T | undefined {
    try {
        return read();
    } catch (error) {
        if (!(error instanceof TokenReadError)) {
            throw error;
        }
        ctx.report(error.id, error.message, error);
        return undefined;
    }
}
