import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { CheckIssue } from "#/core/check/CheckIssue";

type AjvFormatsPlugin = (ajv: Ajv) => Ajv;

/** A JSON Schema document, identified by its {@code $id}. */
export interface JsonSchema {
    readonly $id?: string;
    readonly [key: string]: unknown;
}

/**
 * Compiles the schema with the given id, resolving references between the
 * given schemas.
 *
 * Shared by the Node.js validators, which read schemas from disk, and the
 * browser entry, which bundles them.
 *
 * @throws when no schema has that id.
 */
export function compileSchema(schemas: readonly JsonSchema[], schemaId: string): ValidateFunction {
    const ajv = new Ajv({ allErrors: true, strict: false });
    (addFormats as AjvFormatsPlugin)(ajv);
    for (const schema of schemas) {
        ajv.addSchema(schema, schema.$id);
    }
    const validator = ajv.getSchema(schemaId);
    if (validator === undefined) {
        throw new Error(`AJV schema "${schemaId}" was not loaded.`);
    }
    return validator;
}

/**
 * Validates a value and converts schema errors to check issues.
 *
 * @param label - Prefix for the messages, such as the document number in a
 *   multi-document source.
 */
export function schemaIssues(
    validator: ValidateFunction,
    value: unknown,
    sourcePath: string,
    label?: string,
): CheckIssue[] {
    if (validator(value)) return [];
    return (validator.errors ?? []).map((error) => toSchemaIssue(sourcePath, error, label));
}

/** Converts content that cannot be parsed to a check issue. */
export function syntaxIssue(sourcePath: string, error: unknown, id = "schema"): CheckIssue {
    return {
        id,
        sourcePath,
        severity: "error",
        message: error instanceof Error ? error.message : "Unable to parse token content.",
        raw: error,
    };
}

function toSchemaIssue(sourcePath: string, error: ErrorObject, label?: string): CheckIssue {
    const message = `${error.instancePath || "/"}: ${error.message ?? "Validation error."}`;
    return {
        id: "schema",
        sourcePath,
        severity: "error",
        message: label === undefined ? message : `${label} ${message}`,
        raw: error,
    };
}
