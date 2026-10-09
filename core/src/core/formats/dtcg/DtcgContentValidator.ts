import type { CheckIssue } from "#/core/check/CheckIssue";
import { DTCG_FORMAT_SCHEMA_ID, DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import type { JsonSchema } from "#/core/formats/support/SchemaValidator";
import { AjvSchemaValidator } from "#/core/formats/support/AjvSchemaValidator";

export { DTCG_FORMAT_SCHEMA_ID };

/**
 * Validates DTCG JSON content held in memory.
 *
 * The reader owns the whole check - JSON syntax, the JSON Schema, and the token
 * values - so this only supplies the schemas as data and hands back what the
 * reader found.
 *
 * Has no file-system dependency, so the browser entry can use it.
 */
export class DtcgContentValidator {
    readonly #reader: DtcgReader;

    /**
     * @param schemas - All schema files of one DTCG schema set, including the
     *   format schema and the schemas it references.
     */
    constructor(schemas: readonly JsonSchema[]) {
        this.#reader = new DtcgReader(new AjvSchemaValidator(schemas, DTCG_FORMAT_SCHEMA_ID));
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        return this.#reader.read(content, sourcePath).issues;
    }
}
