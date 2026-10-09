/**
 * Thrown by a reader when one token cannot be read.
 *
 * Carries the diagnostic id next to the message, so the reader states what
 * went wrong in both forms at the point it finds out, and nothing downstream
 * has to derive one from the other.
 *
 * Each format throws its own subclass. {@link readToken} confines the error to
 * the token it was thrown for and reads on, while any other error escapes as
 * the programming error it is.
 */
export class TokenReadError extends Error {
    /** Identifier of the problem, e.g. {@code "invalid-color"}. */
    readonly id: string;

    constructor(id: string, message: string) {
        super(message);
        this.name = "TokenReadError";
        this.id = id;
    }
}
