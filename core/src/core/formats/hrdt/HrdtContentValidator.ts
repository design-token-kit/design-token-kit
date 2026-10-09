import type { CheckIssue } from "#/core/check/CheckIssue";
import { HRDT_SCHEMA_ID, HrdtReader } from "#/core/formats/hrdt/HrdtReader";
import type { JsonSchema } from "#/core/formats/support/SchemaValidator";
import { AjvSchemaValidator } from "#/core/formats/support/AjvSchemaValidator";

export { HRDT_SCHEMA_ID };

/**
 * Validates HRDT YAML content held in memory.
 *
 * The reader owns the whole check - YAML syntax, the JSON Schema, and the token
 * values - so this only supplies the schema as data and hands back what the
 * reader found.
 *
 * Has no file-system dependency, so the browser entry can use it.
 */
export class HrdtContentValidator {
    readonly #reader: HrdtReader;

    constructor(schema: JsonSchema) {
        this.#reader = new HrdtReader(new AjvSchemaValidator([schema], HRDT_SCHEMA_ID));
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        return this.#reader.read(content, sourcePath).issues;
    }
}
