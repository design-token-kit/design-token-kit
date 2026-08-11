import { TokenGroup } from "#/core/model/TokenGroup";

/** Vendor namespace for Design Token Kit extensions. */
export const DTK_EXTENSION = "design-token-kit";

/** Extension field holding the pixel value of one `rem`. */
export const REM_BASE_EXTENSION = "remBase";

/**
 * Reads the `rem` base declared by a token document.
 *
 * @remarks
 * Platforms without a `rem` unit resolve it against a pixel base. The base is
 * a property of the consuming system rather than of the tokens, so an explicit
 * converter option always wins; this extension lets a design system state its
 * own root font size once instead of repeating it per invocation.
 *
 * Invalid values are ignored so that conversion still produces output; the
 * `bad-rem-base` check reports them.
 *
 * @param root - Root group of the token document.
 * @returns Positive pixel base, or undefined when absent or invalid.
 */
export function readRemBase(root: TokenGroup): number | undefined {
    const extension = root.extensions?.[DTK_EXTENSION];
    if (!extension || typeof extension !== "object" || Array.isArray(extension)) {
        return undefined;
    }

    const remBase = (extension as Record<string, unknown>)[REM_BASE_EXTENSION];
    if (typeof remBase !== "number" || !Number.isFinite(remBase) || remBase <= 0) {
        return undefined;
    }

    return remBase;
}
