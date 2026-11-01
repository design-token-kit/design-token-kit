import type { TokenPath } from "#/core/model/TokenPath";

/**
 * What a color token is used for, read from its name.
 *
 * Token sets rarely state which text color is meant for which background, so
 * the audit infers it from common naming conventions:
 *
 * - `text-*`, `foreground-*`, `fg-*` (or a `text` group) are text colors;
 * - `background-*`, `bg-*`, `surface-*`, `canvas-*` are backgrounds;
 * - `on-X` and `text-on-X` are text colors for the background `X`.
 *
 * A role word counts at the start of a name segment, or at its end when the
 * segment has several words, as in `button-text`.
 */
export interface ColorRole {
    readonly kind: "foreground" | "background";

    /**
     * Normalized path of the group the role word appears in. Text colors are
     * paired with backgrounds of the same context only, e.g. the context of
     * `component.button.primary.text` is `component.button.primary`.
     */
    readonly context: string;

    /** Whether the color belongs to the inverse scheme (`text-inverse`, `background-inverse`). */
    readonly inverse: boolean;

    /**
     * For `on-X` text colors: normalized paths of the backgrounds the text is
     * meant for. Such colors are paired with these backgrounds only.
     */
    readonly targets?: readonly string[];
}

const FOREGROUND_WORDS = new Set(["text", "foreground", "fg"]);
const BACKGROUND_WORDS = new Set(["background", "bg", "surface", "canvas"]);

// Disabled controls are exempt from WCAG contrast requirements.
const EXEMPT_WORDS = new Set(["disabled", "inactive"]);

// Overlays dim the page behind a dialog; text is never set on them directly.
const NON_TEXT_BACKGROUND_WORDS = new Set(["overlay", "scrim", "backdrop"]);

const INVERSE_WORDS = new Set(["inverse", "inverted"]);
const ON_WORD = "on";
const BACKGROUND_PREFIXES = ["background", "bg", "surface"];

/**
 * Splits a name segment into lowercase words: `text-Primary`, `text_primary`
 * and `textPrimary` all become `["text", "primary"]`.
 */
export function nameWords(segment: string): string[] {
    return segment
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .split(/[-_\s]+/)
        .map((word) => word.toLowerCase())
        .filter((word) => word.length > 0);
}

/**
 * Returns the normalized dotted form of a path, used to match token names
 * regardless of their casing and word separators.
 */
export function normalizedPath(path: TokenPath): string {
    return path.segments().map((segment) => nameWords(segment).join("-")).join(".");
}

/**
 * Reads the role of a color token from its path.
 *
 * @returns The role, or `undefined` when the name names no role, names both
 *   roles at once, or marks a color that is exempt from contrast rules.
 */
export function colorRole(path: TokenPath): ColorRole | undefined {
    const segments = path.segments().map(nameWords);
    const allWords = segments.flat();
    if (allWords.some((word) => EXEMPT_WORDS.has(word))) return undefined;

    for (let index = 0; index < segments.length; index++) {
        const words = segments[index];
        const role = segmentRole(words, segments.slice(index + 1));
        if (role === "ambiguous") return undefined;
        if (role === undefined) continue;

        const context = segments.slice(0, index).map((segment) => segment.join("-")).join(".");
        if (role.kind === "background" && allWords.some((word) => NON_TEXT_BACKGROUND_WORDS.has(word))) {
            return undefined;
        }
        return {
            kind: role.kind,
            context,
            inverse: allWords.some((word) => INVERSE_WORDS.has(word)),
            targets: role.target === undefined ? undefined : backgroundCandidates(context, role.target),
        };
    }
    return undefined;
}

interface SegmentRole {
    readonly kind: "foreground" | "background";
    /** Normalized name of the background an `on-X` color is meant for. */
    readonly target?: string;
}

function segmentRole(words: string[], rest: string[][]): SegmentRole | "ambiguous" | undefined {
    if (words.length === 0) return undefined;

    if (words[0] === ON_WORD) {
        const target = words.length > 1 ? words.slice(1).join("-") : rest.map((segment) => segment.join("-")).join(".");
        return target === "" ? undefined : { kind: "foreground", target };
    }

    const first = words[0];
    const last = words.length > 1 ? words[words.length - 1] : undefined;
    const foreground = FOREGROUND_WORDS.has(first) || (last !== undefined && FOREGROUND_WORDS.has(last));
    const background = BACKGROUND_WORDS.has(first) || (last !== undefined && BACKGROUND_WORDS.has(last));
    if (foreground && background) return "ambiguous";
    if (background) return { kind: "background" };
    if (!foreground) return undefined;

    // `text-on-brand` is the text color meant for the `brand` background.
    const onIndex = words.indexOf(ON_WORD);
    if (FOREGROUND_WORDS.has(first) && onIndex > 0 && onIndex < words.length - 1) {
        return { kind: "foreground", target: words.slice(onIndex + 1).join("-") };
    }
    return { kind: "foreground" };
}

function backgroundCandidates(context: string, target: string): string[] {
    const prefix = context === "" ? "" : `${context}.`;
    return [
        `${prefix}${target}`,
        ...BACKGROUND_PREFIXES.map((background) => `${prefix}${background}-${target}`),
        ...BACKGROUND_PREFIXES.map((background) => `${prefix}${background}.${target}`),
    ];
}
