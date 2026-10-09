import type { CheckIssue } from "#/core/check/CheckIssue";
import { DesignMdReader } from "#/core/formats/design-md/DesignMdReader";
import { DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { HrdtReader } from "#/core/formats/hrdt/HrdtReader";
import type { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { BrowserTokenSchemaValidator, detectBrowserInputFormat } from "#/browser/BrowserTokenSchemaValidator";
import { BrowserDocumentError } from "#/browser/BrowserTokenValidationError";
import type {
    BrowserDtcgSchema, BrowserInputFormat, BrowserTokenDocument, BrowserTokenSet,
} from "#/browser/BrowserTokenTypes";

/**
 * Loads a base document and named themes without file-system dependencies.
 *
 * Normalized source labels are shared by schema, parser, and model diagnostics.
 */
export class BrowserTokenDocuments {
    readonly #base: SourcedTokenDocument;
    readonly #themes: ReadonlyMap<string, SourcedTokenDocument>;

    /**
     * Assigns source labels without modifying the caller's documents.
     */
    constructor(input: BrowserTokenSet) {
        this.#base = withSource(input.base, "browser-input");
        this.#themes = new Map(Object.entries(input.themes ?? {})
            .map(([name, document]) => [name, withSource(document, name)]));
    }

    /**
     * Checks theme names and document schemas before model parsing.
     */
    validate(schema?: BrowserDtcgSchema): CheckIssue[] {
        const issues: CheckIssue[] = [];
        for (const [name, document] of this.#themes) {
            if (name !== "base" && /^[a-zA-Z0-9_-]+$/.test(name)) continue;
            issues.push({
                id: "theme-name",
                sourcePath: document.source,
                severity: "error",
                message: name === "base"
                    ? 'Theme name "base" is reserved for the base document. Rename the theme.'
                    : `Invalid theme name "${name}". Use letters, numbers, hyphens, or underscores.`,
            });
        }
        for (const document of [this.#base, ...this.#themes.values()]) {
            issues.push(...schemaValidator.validate(document, schema));
        }
        return issues;
    }

    /**
     * Assembles parsed documents and rejects empty sources or colliding themes.
     */
    parse(): DtcgList {
        const [base, ...embeddedThemes]: Dtcg[] = parseDocuments(this.#base);
        if (base === undefined) {
            throw new BrowserDocumentError(this.#base.source, "Token source contains no documents.");
        }
        const themes = new Map<string, Dtcg>();
        embeddedThemes.forEach((document, index) => addTheme(themes, `theme-${index + 1}`, document));
        for (const [name, document] of this.#themes) {
            const documents: Dtcg[] = parseDocuments(document);
            if (documents.length === 0) {
                throw new BrowserDocumentError(document.source, `Theme "${name}" contains no documents.`, "theme-name");
            }
            documents.forEach((parsed, index) => addTheme(themes, index === 0 ? name : `${name}-${index + 1}`, parsed));
        }
        return new DtcgList(base, themes);
    }
}

const schemaValidator = new BrowserTokenSchemaValidator();

interface SourcedTokenDocument extends BrowserTokenDocument {
    readonly source: string;
}

function withSource(document: BrowserTokenDocument, fallback: string): SourcedTokenDocument {
    return { ...document, source: document.source ?? fallback };
}

function parseDocuments(document: SourcedTokenDocument): Dtcg[] {
    const format: BrowserInputFormat = detectBrowserInputFormat(document);
    const reader = format === TokenFormat.DTCG
        ? DtcgReader.noSchema()
        : format === TokenFormat.HRDT
            ? HrdtReader.noSchema()
            : DesignMdReader.noSchema();

    // The schema stage already ran in `validate`, so the reader only has to
    // build the model here; its diagnostics become the document error.
    const result = reader.read(document.content, document.source);
    if (!result.ok) {
        throw new BrowserDocumentError(
            document.source,
            result.issues.map((issue) => issue.message).join("\n"),
            "schema",
        );
    }
    return result.documents;
}

function addTheme(themes: Map<string, Dtcg>, name: string, document: Dtcg): void {
    if (themes.has(name)) {
        throw new BrowserDocumentError(
            document.source ?? "browser-input",
            `Theme name "${name}" is already used by another document. Rename the theme.`,
            "theme-name",
        );
    }
    themes.set(name, document);
}
