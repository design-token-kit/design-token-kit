import { syntaxIssue, type CheckIssue } from "#/core/check/CheckIssue";

/**
 * Raised when a browser operation cannot proceed because of token issues.
 */
export class BrowserTokenValidationError extends Error {
    readonly issues: readonly CheckIssue[];

    /**
     * Preserves diagnostics and the underlying failure when available.
     */
    constructor(issues: readonly CheckIssue[], options?: ErrorOptions) {
        super("Token validation failed.", options);
        this.name = "BrowserTokenValidationError";
        this.issues = [...issues];
    }
}

/**
 * Associates a document loading failure with its source and diagnostic id.
 */
export class BrowserDocumentError extends Error {
    /**
     * Keeps the original parser error available through the standard cause.
     */
    constructor(
        readonly source: string,
        message: string,
        readonly issueId = "schema",
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "BrowserDocumentError";
    }
}

/**
 * Adapts failures at the browser API boundary into structured diagnostics.
 */
// Caught JavaScript failures may have any type, including non-Error values.
export function toBrowserIssue(error: unknown, source: string, issueId = "schema"): CheckIssue {
    if (error instanceof BrowserDocumentError) {
        return syntaxIssue(error.source, error, error.issueId);
    }
    return syntaxIssue(source, error, issueId);
}
