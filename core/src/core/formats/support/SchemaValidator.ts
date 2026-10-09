import type { IssueCollector } from "#/core/formats/support/IssueCollector";

/** A JSON Schema document, identified by its {@code $id}. */
export interface JsonSchema {
    readonly $id?: string;
    readonly [key: string]: unknown;
}

/**
 * Validates a parsed source against a JSON Schema.
 *
 * Validating is synchronous and holds no file-system dependency, so a reader
 * carrying one works wherever the code runs. Obtaining the schemas is a
 * separate concern: a bundle embeds them, Node reads them from disk through
 * {@link FormatSchema}.
 */
export interface SchemaValidator {
    /**
     * Validates the parsed source, recording a diagnostic per schema
     * violation.
     *
     * @param parsed - Source parsed into plain values, not the token model.
     * @param issues - Collects the violations found.
     */
    validate(parsed: unknown, issues: IssueCollector): void;
}

/**
 * Validates nothing, for a reader given no schema to check against.
 *
 * This is a reader's default, and what an environment that cannot load a
 * schema uses: the Figma plugin bundle has no file system, and reads back only
 * the DTCG it generated itself, so the reader's own checks are what it relies
 * on. The browser entry uses it for model parsing, having already run the
 * schema stage against its embedded schemas.
 *
 * Holding no schema also means holding no JSON Schema library, which is what
 * keeps AJV out of bundles that never validate.
 */
export const noSchemaValidator: SchemaValidator = {
    validate(): void {
    },
};
