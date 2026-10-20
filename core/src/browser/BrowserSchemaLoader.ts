import type { SchemaValidator } from "#/core/formats/support/SchemaValidator";

/**
 * Browser builds validate against schemas embedded by BrowserTokenSchemaValidator.
 * The file-backed loaders are intentionally unavailable in browser runtimes.
 */
export async function dtcgSchemaValidator(): Promise<SchemaValidator> {
    throw new Error("DTCG schema loading from disk is unavailable in browser builds");
}

export async function designMdSchemaValidator(): Promise<SchemaValidator> {
    throw new Error("DESIGN.md schema loading from disk is unavailable in browser builds");
}

export async function hrdtSchemaValidator(): Promise<SchemaValidator> {
    throw new Error("HRDT schema loading from disk is unavailable in browser builds");
}
