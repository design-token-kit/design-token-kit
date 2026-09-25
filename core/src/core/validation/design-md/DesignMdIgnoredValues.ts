import type { CheckIssue } from "#/core/check/CheckIssue";
import type { DesignMdReader } from "#/core/io/DesignMdReader";

/**
 * Reports values that the DESIGN.md specification accepts but conversion
 * drops. They are warnings, so the document still loads.
 *
 * Kept free of Node.js imports so the browser entry can share it.
 */
export function ignoredValueIssues(reader: DesignMdReader, raw: unknown, sourcePath: string): CheckIssue[] {
    return reader.ignoredValues(raw).map((message) => ({
        id: "design-md-ignored-value",
        sourcePath,
        severity: "warning",
        message,
    }));
}
