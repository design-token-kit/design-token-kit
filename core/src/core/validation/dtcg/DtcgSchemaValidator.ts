import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/io/Source";
import { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";

type AjvFormatsPlugin = (ajv: Ajv) => Ajv;

const FORMAT_SCHEMA_ID = "https://www.designtokens.org/schemas/2025.10/format.json";

/**
 * Validates DTCG JSON sources against the official DTCG JSON Schema.
 * Accepts DTCG JSON sources only.
 */
export class DtcgSchemaValidator implements TokenValidator {
    async validate(sources: string[]): Promise<CheckIssue[]> {
        const ajv = await this.#createAjv();

        const validator = ajv.getSchema(FORMAT_SCHEMA_ID);
        if (!validator) {
            throw new Error(`AJV schema "${FORMAT_SCHEMA_ID}" was not loaded.`);
        }

        const issues: CheckIssue[] = [];
        for (const source of sources) {
            const content = await new Source(source).getContent();
            const sourceJson = JSON.parse(content) as unknown;
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
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const schemaDir = path.resolve(moduleDir, "schemas/2025.10");

        const ajv = new Ajv({ allErrors: true, strict: false });
        (addFormats as AjvFormatsPlugin)(ajv);

        for (const schemaFilePath of await listJsonFiles(schemaDir)) {
            const rawSchema = await readFile(schemaFilePath, "utf8");
            const schema = JSON.parse(rawSchema) as JsonSchema;
            ajv.addSchema(schema, schema.$id ?? schemaFilePath);
        }

        return ajv;
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
