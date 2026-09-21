import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/io/Source";
import { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";

type AjvFormatsPlugin = (ajv: Ajv) => Ajv;

const FORMAT_SCHEMA_ID = "https://www.designtokens.org/schemas/2025.10/format.json";
const DEFAULT_SCHEMA = "2025.10";

/**
 * Validates DTCG JSON sources against the official DTCG JSON Schema.
 * Accepts DTCG JSON sources only.
 */
export class DtcgSchemaValidator implements TokenValidator {
    readonly #schema: string;

    /**
     * @param schema - DTCG JSON Schema, one of:
     *   - a directory path holding schema files
     *   - a built-in schema name:
     *     - "2025.10": stock DTCG 2025.10
     *     - "2025.10-design.md": "2025.10" extended with the "em" dimension
     *       unit for DESIGN.md
     *
     *   Defaults to the built-in "2025.10" schema.
     */
    constructor(schema?: string) {
        this.#schema = schema ?? DEFAULT_SCHEMA;
    }

    async validate(sources: string[]): Promise<CheckIssue[]> {
        const ajv = await this.#createAjv();

        const validator = ajv.getSchema(FORMAT_SCHEMA_ID);
        if (!validator) {
            throw new Error(`AJV schema "${FORMAT_SCHEMA_ID}" was not loaded.`);
        }

        const issues: CheckIssue[] = [];
        for (const source of sources) {
            const content = await new Source(source).getContent();
            const sourceJson = addInheritedTokenTypes(JSON.parse(content) as unknown);
            const isValid = validator(sourceJson);
            if (isValid) {
                continue;
            }
            const errors = validator.errors ?? [];
            for (const error of errors) {
                issues.push(this.#toCheckIssue(source, error));
            }
        }

        return issues;
    }

    async #createAjv(): Promise<Ajv> {
        const schemaDir = this.#resolveSchemaDir();

        const ajv = new Ajv({ allErrors: true, strict: false });
        (addFormats as AjvFormatsPlugin)(ajv);

        for (const schemaFilePath of await listJsonFiles(schemaDir)) {
            const rawSchema = await readFile(schemaFilePath, "utf8");
            const schema = JSON.parse(rawSchema) as JsonSchema;
            ajv.addSchema(schema, schema.$id ?? schemaFilePath);
        }

        return ajv;
    }

    #resolveSchemaDir(): string {
        if (path.isAbsolute(this.#schema) || existsSync(this.#schema)) {
            return this.#schema;
        }
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(moduleDir, `schemas/${this.#schema}`);
    }

    #toCheckIssue(sourcePath: string, error: ErrorObject): CheckIssue {
        const instancePath = error.instancePath || "/";
        const message = error.message ?? "Validation error.";
        return {
            id: "schema",
            sourcePath,
            severity: "error",
            message: `${instancePath}: ${message}`,
            raw: error,
        };
    }
}

interface JsonSchema {
    $id?: string;
    [key: string]: unknown;
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

async function listJsonFiles(directoryPath: string): Promise<string[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listJsonFiles(entryPath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
            files.push(entryPath);
        }
    }

    return files;
}
