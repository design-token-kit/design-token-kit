import type { ValidateFunction } from "ajv";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { compileSchema, schemaIssues, syntaxIssue, type JsonSchema } from "#/core/validation/SchemaValidation";

export const DTCG_FORMAT_SCHEMA_ID = "https://www.designtokens.org/schemas/2025.10/format.json";

/**
 * Validates DTCG JSON content held in memory against the DTCG JSON Schema.
 *
 * Has no file-system dependency, so the browser entry shares it with
 * {@link DtcgSchemaValidator}.
 */
export class DtcgContentValidator {
    readonly #validator: ValidateFunction;

    /**
     * @param schemas - All schema files of one DTCG schema set, including the
     *   format schema and the schemas it references.
     */
    constructor(schemas: readonly JsonSchema[]) {
        this.#validator = compileSchema(schemas, DTCG_FORMAT_SCHEMA_ID);
    }

    validate(content: string, sourcePath: string): CheckIssue[] {
        let json: unknown;
        try {
            json = JSON.parse(content);
        } catch (error) {
            return [syntaxIssue(sourcePath, error)];
        }
        return schemaIssues(this.#validator, addInheritedTokenTypes(json), sourcePath);
    }
}

type JsonObject = Record<string, unknown>;

/**
 * Copies group-level `$type` values onto descendant tokens for schema validation.
 *
 * The DTCG schema validates token values through a type-specific union, while
 * the format allows a token to inherit `$type` from its nearest group. AJV
 * cannot resolve that inheritance itself, so validation uses this copy only.
 */
function addInheritedTokenTypes(value: unknown, inheritedType?: string): unknown {
    if (!isJsonObject(value)) return value;

    const effectiveType = resolveEffectiveType(value, inheritedType);
    if (isTokenObject(value)) {
        if (value["$type"] !== undefined || effectiveType === undefined) return value;
        return { ...value, "$type": effectiveType };
    }

    const normalized: JsonObject = { ...value };
    const root = value["$root"];
    if (isJsonObject(root)) {
        normalized["$root"] = addInheritedTokenTypes(root, effectiveType);
    }

    for (const [key, child] of Object.entries(value)) {
        if (key.startsWith("$") || key === "$root") continue;
        if (isJsonObject(child)) {
            normalized[key] = addInheritedTokenTypes(child, effectiveType);
        }
    }

    return normalized;
}

function resolveEffectiveType(value: JsonObject, inheritedType: string | undefined): string | undefined {
    if (!("$type" in value)) return inheritedType;
    return typeof value["$type"] === "string" ? value["$type"] : undefined;
}

function isTokenObject(value: JsonObject): boolean {
    return "$value" in value || "$ref" in value;
}

function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
