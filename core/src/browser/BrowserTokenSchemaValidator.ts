import { syntaxIssue, type CheckIssue } from "#/core/check/CheckIssue";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { tokenFormats } from "#/core/formats/tokenFormats";
import { DesignMdContentValidator } from "#/core/formats/design-md/DesignMdContentValidator";
import { DtcgContentValidator } from "#/core/formats/dtcg/DtcgContentValidator";
import { HrdtContentValidator } from "#/core/formats/hrdt/HrdtContentValidator";
import type { JsonSchema } from "#/core/formats/support/SchemaValidator";
import type { BrowserDtcgSchema, BrowserInputFormat, BrowserTokenDocument } from "#/browser/BrowserTokenTypes";
import { BrowserDocumentError } from "#/browser/BrowserTokenValidationError";
import designMdSchema from "#/core/formats/design-md/schemas/design-md-tokens.json";
import hrdtSchema from "#/core/formats/hrdt/schemas/hrdt-tokens.json";

/**
 * Validates in-memory documents using bundled, lazily compiled schemas.
 */
export class BrowserTokenSchemaValidator {
    readonly #validators = new Map<string, ContentValidator>();

    /**
     * Returns schema diagnostics without accessing files or the network.
     */
    validate(document: BrowserTokenDocument, schemaName: BrowserDtcgSchema = "2025.10"): CheckIssue[] {
        const source: string = document.source ?? "browser-input";
        try {
            const format: BrowserInputFormat = detectBrowserInputFormat(document);
            return this.#validator(format, schemaName).validate(document.content, source);
        } catch (error) {
            return [syntaxIssue(source, error)];
        }
    }

    #validator(format: BrowserInputFormat, schemaName: BrowserDtcgSchema): ContentValidator {
        const key: string = format === TokenFormat.DTCG ? `${format}:${schemaName}` : format;
        const cached: ContentValidator | undefined = this.#validators.get(key);
        if (cached !== undefined) return cached;
        const validator: ContentValidator = createValidator(format, schemaName);
        this.#validators.set(key, validator);
        return validator;
    }
}

/**
 * Resolves supported token input formats and rejects output-only formats.
 */
export function detectBrowserInputFormat(document: BrowserTokenDocument): BrowserInputFormat {
    const detected: TokenFormat = document.format
        ?? tokenFormats.detect(document.content, document.source).format;
    if (detected !== TokenFormat.DTCG && detected !== TokenFormat.HRDT && detected !== TokenFormat.DESIGN_MD) {
        throw new BrowserDocumentError(
            document.source ?? "browser-input",
            `Unsupported browser token input format "${detected}". Expected DTCG, HRDT, or DESIGN.md.`,
        );
    }
    return detected;
}

interface ContentValidator {
    validate(content: string, sourcePath: string): CheckIssue[];
}

const DTCG_SCHEMAS = import.meta.glob<JsonSchema>(
    "../core/formats/dtcg/schemas/*/**/*.json",
    { eager: true, import: "default" },
);

function createValidator(format: BrowserInputFormat, schemaName: BrowserDtcgSchema): ContentValidator {
    if (format === TokenFormat.HRDT) return new HrdtContentValidator(hrdtSchema);
    if (format === TokenFormat.DESIGN_MD) return new DesignMdContentValidator(designMdSchema);
    const prefix: string = `/schemas/${schemaName}/`;
    const schemas: JsonSchema[] = Object.entries(DTCG_SCHEMAS)
        .filter(([path]) => path.replaceAll("\\", "/").includes(prefix))
        .map(([, schema]) => schema);
    return new DtcgContentValidator(schemas);
}
