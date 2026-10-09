import type { CheckIssue } from "#/core/check/CheckIssue";
import { DESIGN_MD_SCHEMA_ID, DesignMdReader } from "#/core/formats/design-md/DesignMdReader";
import type { JsonSchema } from "#/core/formats/support/SchemaValidator";
import { AjvSchemaValidator } from "#/core/formats/support/AjvSchemaValidator";

export { DESIGN_MD_SCHEMA_ID };

/**
 * Validates DESIGN.md content held in memory.
 *
 * The reader owns the whole check - frontmatter syntax, the JSON Schema, and
 * the values it has to convert - so this only supplies the schema as data and
 * hands back what the reader found. Values the specification accepts but the
 * model cannot hold come back as warnings, leaving the document usable.
 *
 * Has no file-system dependency, so the browser entry can use it.
 */
export class DesignMdContentValidator {
    readonly #reader: DesignMdReader;

    constructor(schema: JsonSchema) {
        this.#reader = new DesignMdReader(new AjvSchemaValidator([schema], DESIGN_MD_SCHEMA_ID));
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        return this.#reader.read(content, sourcePath).issues;
    }
}
