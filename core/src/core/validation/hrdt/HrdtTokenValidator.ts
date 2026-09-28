import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/io/Source";
import { TokenValidator } from "#/core/validation/TokenValidator";
import { HrdtContentValidator } from "#/core/validation/hrdt/HrdtContentValidator";
import type { JsonSchema } from "#/core/validation/SchemaValidation";
import type { CheckIssue } from "#/core/check/CheckIssue";

/**
 * Validator based on AJV and JSON Schema.
 * Accepts HRDT sources only, including multi-document sources.
 *
 * Reads sources and the schema file from disk; validation itself is done by
 * {@link HrdtContentValidator}.
 */
export class HrdtTokenValidator implements TokenValidator {
    async validate(sources: string[]): Promise<CheckIssue[]> {
        const validator = new HrdtContentValidator(await readSchema());
        const issues: CheckIssue[] = [];
        for (const source of sources) {
            const content = await new Source(source).getContent();
            issues.push(...validator.validate(content, source));
        }
        return issues;
    }
}

async function readSchema(): Promise<JsonSchema> {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.resolve(moduleDir, "schemas/hrdt-tokens.json");
    return JSON.parse(await readFile(schemaPath, "utf8")) as JsonSchema;
}
