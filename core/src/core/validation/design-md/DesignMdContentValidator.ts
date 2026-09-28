import type { ValidateFunction } from "ajv";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { DesignMdReader } from "#/core/io/DesignMdReader";
import { compileSchema, schemaIssues, syntaxIssue, type JsonSchema } from "#/core/validation/SchemaValidation";

export const DESIGN_MD_SCHEMA_ID = "https://designtokens.local/schemas/design-md-tokens.json";

/**
 * Validates DESIGN.md content held in memory: the frontmatter against its
 * JSON Schema, then the values the reader must convert.
 *
 * Values that the specification accepts but conversion drops are reported as
 * warnings, so the document still loads.
 *
 * Has no file-system dependency, so the browser entry shares it with
 * {@link DesignMdTokenValidator}.
 */
export class DesignMdContentValidator {
    readonly #validator: ValidateFunction;

    constructor(schema: JsonSchema) {
        this.#validator = compileSchema([schema], DESIGN_MD_SCHEMA_ID);
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        const reader = new DesignMdReader();
        try {
            const raw = reader.parseRaw(content);
            const issues = schemaIssues(this.#validator, raw, sourcePath);
            if (issues.length > 0) return issues;

            reader.parse(content, sourcePath);
            return reader.ignoredValues(raw).map((message) => ({
                id: "design-md-ignored-value",
                sourcePath,
                severity: "warning",
                message,
            }));
        } catch (error) {
            return [syntaxIssue(sourcePath, error)];
        }
    }
}
