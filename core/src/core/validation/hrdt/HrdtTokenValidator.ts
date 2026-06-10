import Ajv, { ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/Source";
import { HrdtTokenReader } from "#/core/io/HrdtTokenReader";
import {
    ValidationIssue,
    TokenValidator,
} from "#/core/validation/TokenValidator";

type AjvFormatsPlugin = (ajv: Ajv) => Ajv;

const SCHEMA_ID = "https://designtokens.local/schemas/hrdt-tokens.json";

/**
 * Validator based on AJV and JSON Schema.
 * Accepts HRDT sources only.
 */
export class HrdtTokenValidator implements TokenValidator {
    readonly name = "hrdt";

    async validate(sources: string[]): Promise<ValidationIssue[]> {
        const ajv = await this.#createAjv();

        const validator = ajv.getSchema(SCHEMA_ID);
        if (!validator) {
            throw new Error(`AJV schema "${SCHEMA_ID}" was not loaded.`);
        }

        const issues: ValidationIssue[] = [];
        for (const source of sources) {
            const content = await new Source(source).getContent();
            const sourceObj = new HrdtTokenReader().parseRaw(content);
            const isValid = validator(sourceObj);
            if (isValid) {
                continue;
            }
            const errors = validator.errors ?? [];
            for (const error of errors) {
                issues.push(this.#toValidationIssue(source, error));
            }
        }

        return issues;
    }

    async #createAjv(): Promise<Ajv> {
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        const schemaPath = path.resolve(moduleDir, "schemas/hrdt-tokens.json");

        const ajv = new Ajv({ allErrors: true, strict: false });
        (addFormats as AjvFormatsPlugin)(ajv);

        const rawSchema = await readFile(schemaPath, "utf8");
        const schema = JSON.parse(rawSchema) as JsonSchema;
        ajv.addSchema(schema, schema.$id ?? schemaPath);

        return ajv;
    }

    #toValidationIssue(sourcePath: string, error: ErrorObject): ValidationIssue {
        const instancePath = error.instancePath || "/";
        const message = error.message ?? "Validation error.";
        return {
            name: this.name,
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
