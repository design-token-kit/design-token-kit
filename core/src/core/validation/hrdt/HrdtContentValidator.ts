import type { ValidateFunction } from "ajv";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { HrdtTokenParser } from "#/core/io/HrdtTokenParser";
import { compileSchema, schemaIssues, syntaxIssue, type JsonSchema } from "#/core/validation/SchemaValidation";

export const HRDT_SCHEMA_ID = "https://designtokens.local/schemas/hrdt-tokens.json";

/**
 * Validates HRDT YAML content held in memory against the HRDT JSON Schema.
 *
 * Each YAML document is validated separately, because a multi-document source
 * holds a base document followed by themes.
 *
 * Has no file-system dependency, so the browser entry shares it with
 * {@link HrdtTokenValidator}.
 */
export class HrdtContentValidator {
    readonly #validator: ValidateFunction;

    constructor(schema: JsonSchema) {
        this.#validator = compileSchema([schema], HRDT_SCHEMA_ID);
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        let documents: unknown[];
        try {
            documents = new HrdtTokenParser().parseAllRaw(content);
        } catch (error) {
            return [syntaxIssue(sourcePath, error)];
        }
        return documents.flatMap((document, index) => schemaIssues(
            this.#validator,
            document,
            sourcePath,
            documents.length > 1 ? `document ${index + 1}` : undefined,
        ));
    }
}
