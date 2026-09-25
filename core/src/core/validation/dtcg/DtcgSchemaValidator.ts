import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/io/Source";
import { TokenValidator } from "#/core/validation/TokenValidator";
import { DtcgContentValidator } from "#/core/validation/dtcg/DtcgContentValidator";
import type { JsonSchema } from "#/core/validation/SchemaValidation";
import type { CheckIssue } from "#/core/check/CheckIssue";

const DEFAULT_SCHEMA = "2025.10";

/**
 * Validates DTCG JSON sources against the official DTCG JSON Schema.
 * Accepts DTCG JSON sources only.
 *
 * Reads sources and schema files from disk; validation itself is done by
 * {@link DtcgContentValidator}.
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
        const validator = new DtcgContentValidator(await this.#readSchemas());
        const issues: CheckIssue[] = [];
        for (const source of sources) {
            const content = await new Source(source).getContent();
            issues.push(...validator.validate(content, source));
        }
        return issues;
    }

    async #readSchemas(): Promise<JsonSchema[]> {
        const schemaDir = this.#resolveSchemaDir();
        const schemas: JsonSchema[] = [];
        for (const schemaFilePath of await listJsonFiles(schemaDir)) {
            const schema = JSON.parse(await readFile(schemaFilePath, "utf8")) as JsonSchema;
            schemas.push(schema.$id === undefined ? { ...schema, $id: schemaFilePath } : schema);
        }
        return schemas;
    }

    #resolveSchemaDir(): string {
        if (path.isAbsolute(this.#schema) || existsSync(this.#schema)) {
            return this.#schema;
        }
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        return path.resolve(moduleDir, `schemas/${this.#schema}`);
    }
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
