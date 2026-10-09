import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { IssueCollector } from "#/core/formats/support/IssueCollector";
import type { JsonSchema, SchemaValidator } from "#/core/formats/support/SchemaValidator";

type AjvFormatsPlugin = (ajv: Ajv) => Ajv;

/**
 * Validates against a JSON Schema using AJV.
 *
 * Compiles on construction so that validating is synchronous afterwards. Kept
 * apart from {@link SchemaValidator} because importing it means importing AJV:
 * a reader given no schema must not drag the library into a bundle that never
 * validates.
 */
export class AjvSchemaValidator implements SchemaValidator {
    readonly #validate: ValidateFunction;

    /**
     * @param schemas - All parts of one schema. A schema split across files
     *   lists every part, so they can reference each other.
     * @param schemaId - {@code $id} of the schema to validate against.
     *
     * @throws when no schema has that id.
     */
    constructor(schemas: readonly JsonSchema[], schemaId: string) {
        this.#validate = this.#createAjvValidator(schemas, schemaId);
    }

    validate(parsed: unknown, issues: IssueCollector): void {
        if (this.#validate(parsed)) {
            return;
        }
        for (const error of this.#validate.errors ?? []) {
            issues.add("schema", messageOf(error), { raw: error });
        }
    }

    /**
     * Creates the AJV validator for the schema with the given id.
     *
     * Every schema is registered, not just the one asked for: that is what
     * lets the parts of a split schema reference each other.
     */
    #createAjvValidator(schemas: readonly JsonSchema[], schemaId: string): ValidateFunction {
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
}

/**
 * Renders a schema violation as a message naming the offending location.
 */
function messageOf(error: ErrorObject): string {
    return `${error.instancePath || "/"}: ${error.message ?? "Validation error."}`;
}
