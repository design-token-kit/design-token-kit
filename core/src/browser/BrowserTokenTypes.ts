import type { CheckScope } from "#/core/check/CheckScope";
import type { TokenFormat } from "#/core/formats/TokenFormat";
import type { PlatformFormat } from "#/core/platforms/PlatformFormat";

/**
 * A document held in browser memory rather than addressed by a file path.
 */
export interface BrowserTokenDocument {
    readonly content: string;
    readonly source?: string;
    readonly format?: BrowserInputFormat;
}

/**
 * A base document and optional, named theme overrides.
 *
 * Theme names use letters, numbers, hyphens, or underscores.
 * The name "base" is reserved for the base document.
 */
export interface BrowserTokenSet {
    readonly base: BrowserTokenDocument;
    readonly themes?: Readonly<Record<string, BrowserTokenDocument>>;
}

/**
 * Input formats accepted by the browser toolkit.
 */
export type BrowserInputFormat = TokenFormat.DTCG | TokenFormat.HRDT | TokenFormat.DESIGN_MD;

/**
 * Output formats emitted by the browser toolkit.
 */
export type BrowserOutputFormat =
    | BrowserInputFormat
    | PlatformFormat.CSS
    | PlatformFormat.SCSS
    | PlatformFormat.TAILWIND_V4
    | PlatformFormat.SWIFT_UI
    | PlatformFormat.FIGMA_SCRIPT
    | PlatformFormat.ANDROID
    | "showcase";

/**
 * Options controlling a browser validation run.
 */
export interface BrowserCheckOptions {
    /**
     * Check depth; conversion and statistics always require model validation.
     */
    readonly scope?: CheckScope;
    readonly layers?: readonly string[];
    /**
     * Check allow-list for check(). Omitted uses default-enabled checks, while
     * an empty list runs all checks. Conversion and statistics run all model checks.
     */
    readonly checks?: readonly string[];
    readonly schema?: BrowserDtcgSchema;
}

/**
 * Built-in DTCG schemas available without a server or file system.
 */
export type BrowserDtcgSchema = "2025.10" | "2025.10-design.md";

/**
 * A file-like output that the host can display or download with a Blob.
 */
export interface BrowserTokenOutput {
    readonly fileName: string;
    readonly content: string;
    readonly themeName?: string;
}
