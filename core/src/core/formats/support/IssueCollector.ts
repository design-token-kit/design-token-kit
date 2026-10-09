import { TokenPath } from "#/core/model/TokenPath";
import type { CheckIssue, IssueSeverity } from "#/core/check/CheckIssue";
import type { SourcePosition } from "#/core/formats/support/SourceLocation";

/**
 * Collects diagnostics while a reader walks a source.
 *
 * A reader reports every problem it finds instead of stopping at the first, so
 * one read tells the author everything that needs fixing.
 */
export class IssueCollector {
    readonly #issues: CheckIssue[] = [];
    readonly #sourcePath?: string;

    /**
     * @param sourcePath - Path or identifier of the source being read,
     *   attached to every collected diagnostic.
     */
    constructor(sourcePath?: string) {
        this.#sourcePath = sourcePath;
    }

    /**
     * Records a diagnostic.
     *
     * @param id - Identifier of the problem, e.g. {@code "invalid-color"}.
     * @param message - What is wrong, in the author's terms.
     * @param options - Where the problem is and how severe it is.
     */
    add(
        id: string,
        message: string,
        options: {
            readonly tokenPath?: TokenPath;
            readonly position?: SourcePosition;
            readonly severity?: IssueSeverity;
            readonly raw?: unknown;
        } = {},
    ): void {
        this.#issues.push({
            id,
            message,
            severity: options.severity ?? "error",
            sourcePath: this.#sourcePath,
            tokenPath: options.tokenPath,
            line: options.position?.line,
            column: options.position?.column,
            raw: options.raw,
        });
    }

    /**
     * True when at least one error was recorded.
     *
     * Warnings do not fail a read: they report what the source expresses but
     * the token model cannot hold, which leaves the documents usable.
     */
    get failed(): boolean {
        return this.#issues.some((issue) => issue.severity === "error");
    }

    /** The collected diagnostics, in the order they were recorded. */
    get issues(): CheckIssue[] {
        return this.#issues;
    }
}
