import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Format } from "#/core/io/Format";
import type { DtcgList } from "#/core/model/DtcgList";

/**
 * Blocks file-path loading from browser bundles.
 *
 * Platform converters retain their file-oriented convenience method, but the
 * browser API always supplies an in-memory {@link DtcgList} instead.
 */
export class DtcgListLoader {

    constructor(_schema?: string) {}

    async load(_sources: string[], _format?: Format): Promise<DtcgList> {
        throw new Error("File-source token loading is unavailable in the browser entry.");
    }

}

/**
 * Preserves the error contract required by platform converter imports.
 */
export class TokenSyntaxError extends Error {
    readonly issues: CheckIssue[];

    constructor(issues: CheckIssue[]) {
        super("File-source token loading is unavailable in the browser entry.");
        this.name = "TokenSyntaxError";
        this.issues = issues;
    }

    formatIssues(): string {
        return this.issues
            .map((issue) => `[${issue.id}] ${issue.sourcePath} - ${issue.message}`)
            .join("\n");
    }
}
