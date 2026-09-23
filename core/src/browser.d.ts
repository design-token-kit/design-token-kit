import { CheckScope, Format } from "./index.js";
import type { CheckIssue } from "./index.js";

export { CheckScope, Format };
export type { CheckIssue, IssueSeverity } from "./index.js";

/** A document held in browser memory rather than addressed by a file path. */
export interface BrowserTokenDocument {
    readonly content: string;
    readonly source?: string;
    readonly format?: BrowserInputFormat;
}

/** A base document and optional, named theme overrides. */
export interface BrowserTokenSet {
    readonly base: BrowserTokenDocument;
    readonly themes?: Readonly<Record<string, BrowserTokenDocument>>;
}

/** Input formats accepted by the browser toolkit. */
export type BrowserInputFormat = Format.DTCG | Format.HRDT | Format.DESIGN_MD;

/** Output formats emitted by the browser toolkit. */
export type BrowserOutputFormat =
    | BrowserInputFormat
    | Format.CSS
    | Format.SCSS
    | Format.TAILWIND_V4
    | Format.SWIFT_UI
    | Format.FIGMA_SCRIPT
    | Format.ANDROID
    | "showcase";

/** Built-in DTCG schemas available without a server or file system. */
export type BrowserDtcgSchema = "2025.10" | "2025.10-design.md";

/** Options controlling a browser validation run. */
export interface BrowserCheckOptions {
    readonly scope?: CheckScope;
    readonly layers?: readonly string[];
    readonly checks?: readonly string[];
    readonly schema?: BrowserDtcgSchema;
}

/** A file-like output that the host can display or download with a Blob. */
export interface BrowserTokenOutput {
    readonly fileName: string;
    readonly content: string;
    readonly themeName?: string;
}

/** A summary item calculated from a parsed token list. */
export interface TokenStat {
    readonly label: string;
    readonly value: number;
    readonly percentage?: number;
    readonly description?: string;
    readonly breakdowns?: readonly {
        readonly label: string;
        readonly items: readonly {
            readonly label: string;
            readonly value?: number;
            readonly percentage?: number;
        }[];
    }[];
}

/** Raised when conversion cannot proceed because the input has validation issues. */
export declare class BrowserTokenValidationError extends Error {
    readonly issues: readonly CheckIssue[];
    constructor(issues: readonly CheckIssue[]);
}

/**
 * Validates, converts, showcases, and measures token content in the browser.
 *
 * The toolkit never reads paths, uses temporary files, or sends token content
 * over the network. The UI owns file picking, URL fetching, and downloads.
 */
export declare class BrowserTokenToolkit {
    check(input: BrowserTokenSet, options?: BrowserCheckOptions): CheckIssue[];
    convert(
        input: BrowserTokenSet,
        format: BrowserOutputFormat,
        options?: BrowserCheckOptions,
    ): BrowserTokenOutput[];
    stats(input: BrowserTokenSet, options?: BrowserCheckOptions): readonly TokenStat[];
}
