import type { CheckIssue } from "@design-token-kit/core/core/check/CheckIssue";
import type { Format } from "@design-token-kit/core/core/io/Format";
import type { DtcgList } from "@design-token-kit/core/core/model/DtcgList";

/**
 * Replaces the core file-source loader inside the Figma plugin bundle.
 *
 * Core platform converters keep a `DtcgListLoader` field for their
 * `convert(sources)` API.
 * That API reads files and depends on Node modules, so it cannot run in Figma.
 *
 * The plugin never calls `convert(sources)`.
 * It exports tokens from Figma, builds a `DtcgList` in memory, and calls
 * `convertList()` on the real core converters.
 *
 * Vite aliases only `#/core/io/DtcgListLoader` to this adapter.
 * All other `#/...` imports still resolve to `core/src/*`, matching the
 * package-import layout used by the rest of the workspace.
 */
export class DtcgListLoader {

    constructor(_schemaVersion?: string) {}

    async load(_sources: string[], _forcedFormat?: Format): Promise<DtcgList> {
        throw new Error("File-source token loading is unavailable in the Figma plugin.");
    }

}

/**
 * Keeps the exported core error name available for modules that import it.
 *
 * This class exists only to satisfy imports in the browser bundle.
 */
export class TokenSyntaxError extends Error {
    readonly issues: CheckIssue[];

    constructor(issues: CheckIssue[]) {
        super("File-source token loading is unavailable in the Figma plugin.");
        this.name = "TokenSyntaxError";
        this.issues = issues;
    }

    formatIssues(): string {
        return this.issues
            .map((issue) => `[${issue.id}] ${issue.sourcePath} - ${issue.message}`)
            .join("\n");
    }

}
