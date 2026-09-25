import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Source } from "#/core/io/Source";
import { TokenValidator } from "#/core/validation/TokenValidator";
import { DesignMdContentValidator } from "#/core/validation/design-md/DesignMdContentValidator";
import type { JsonSchema } from "#/core/validation/SchemaValidation";
import type { CheckIssue } from "#/core/check/CheckIssue";

/**
 * Validates DESIGN.md YAML frontmatter against its JSON Schema.
 *
 * Reads sources and the schema file from disk; validation itself is done by
 * {@link DesignMdContentValidator}.
 */
export class DesignMdTokenValidator implements TokenValidator {
    async validate(sources: string[]): Promise<CheckIssue[]> {
        const validator = new DesignMdContentValidator(await readSchema());
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
    const schemaPath = path.resolve(moduleDir, "schemas/design-md-tokens.json");
    return JSON.parse(await readFile(schemaPath, "utf8")) as JsonSchema;
}
