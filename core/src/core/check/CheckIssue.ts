import { TokenPath } from "#/core/model/TokenPath";

/**
 * Severity level of a diagnostic.
 */
export type IssueSeverity = "error" | "warning";

/**
 * A single diagnostic produced by a check.
 */
export interface CheckIssue {
    /**
     * Identifier of the check that produced this diagnostic, e.g. {@code "bad-reference"}.
     */
    readonly id: string;

    /**
     * Path to the source file.
     */
    readonly sourcePath?: string;

    /**
     * Path to the token or group where the issue was found.
     */
    readonly tokenPath?: TokenPath;

    /**
     * Message text.
     */
    readonly message: string;

    /**
     * Severity level.
     */
    readonly severity: IssueSeverity;

    /**
     * Line number (if available).
     */
    readonly line?: number;

    /**
     * Column number (if available).
     */
    readonly column?: number;

    /**
     * Raw data for debugging.
     */
    readonly raw?: unknown;
}
