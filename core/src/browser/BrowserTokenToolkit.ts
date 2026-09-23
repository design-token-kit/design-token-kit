import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { CheckRunner } from "#/core/check/CheckRunner";
import { CheckScope } from "#/core/check/CheckScope";
import { TokenLayers } from "#/core/check/TokenLayers";
import { lintingChecks, validationChecks } from "#/core/check/checks/Checks";
import type { CheckIssue } from "#/core/check/CheckIssue";
import type { Check } from "#/core/check/Check";
import { DesignMdReader } from "#/core/io/DesignMdReader";
import { DesignMdWriter } from "#/core/io/DesignMdWriter";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgJsonWriter } from "#/core/io/DtcgJsonWriter";
import { DtcgToDesignMdMapper } from "#/core/io/DtcgToDesignMdMapper";
import { Format } from "#/core/io/Format";
import { FormatDetector } from "#/core/io/FormatDetector";
import { HrdtTokenParser } from "#/core/io/HrdtTokenParser";
import { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
import { DtcgList } from "#/core/model/DtcgList";
import type { Dtcg } from "#/core/model/Dtcg";
import { AndroidTokenConverter } from "#/core/platforms/android/AndroidTokenConverter";
import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { FigmaScriptTokenConverter } from "#/core/platforms/figma-script/FigmaScriptTokenConverter";
import { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";
import { CssTokenParser, type ParsedTokenCss } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import { TokenStatsCalculator, type TokenStat } from "#/core/stats/TokenStatsCalculator";

import designMdSchema from "#/core/validation/design-md/schemas/design-md-tokens.json";
import hrdtSchema from "#/core/validation/hrdt/schemas/hrdt-tokens.json";

const DTCG_SCHEMA_ID = "https://www.designtokens.org/schemas/2025.10/format.json";
const DTCG_SCHEMAS = import.meta.glob<JsonSchema>(
    "../core/validation/dtcg/schemas/*/**/*.json",
    { eager: true, import: "default" },
);

/** A document held in browser memory rather than addressed by a file path. */
export interface BrowserTokenDocument {
    readonly content: string;
    readonly source?: string;
    readonly format?: BrowserInputFormat;
}

/** A base document and optional, named theme overrides. */
export interface BrowserTokenSet {
    readonly base: BrowserTokenDocument;
    readonly themes?: Readonly<Record<string, BrowserTokenDocument>>;
}

/** Input formats accepted by the browser toolkit. */
export type BrowserInputFormat = Format.DTCG | Format.HRDT | Format.DESIGN_MD;

/** Output formats emitted by the browser toolkit. */
export type BrowserOutputFormat =
    | BrowserInputFormat
    | Format.CSS
    | Format.SCSS
    | Format.TAILWIND_V4
    | Format.SWIFT_UI
    | Format.FIGMA_SCRIPT
    | Format.ANDROID
    | "showcase";

/** Options controlling a browser validation run. */
export interface BrowserCheckOptions {
    readonly scope?: CheckScope;
    readonly layers?: readonly string[];
    readonly checks?: readonly string[];
    readonly schema?: BrowserDtcgSchema;
}

/** Built-in DTCG schemas available without a server or file system. */
export type BrowserDtcgSchema = "2025.10" | "2025.10-design.md";

/** A file-like output that the host can display or download with a Blob. */
export interface BrowserTokenOutput {
    readonly fileName: string;
    readonly content: string;
    readonly themeName?: string;
}

/** Raised when conversion cannot proceed because the input has validation issues. */
export class BrowserTokenValidationError extends Error {
    readonly issues: readonly CheckIssue[];

    constructor(issues: readonly CheckIssue[]) {
        super("Token validation failed.");
        this.name = "BrowserTokenValidationError";
        this.issues = issues;
    }
}

/**
 * Validates, converts, showcases, and measures token content in the browser.
 *
 * The toolkit never reads paths, uses temporary files, or sends token content
 * over the network. The UI owns file picking, URL fetching, and downloads.
 */
export class BrowserTokenToolkit {

    check(input: BrowserTokenSet, options: BrowserCheckOptions = {}): CheckIssue[] {
        const documents = this.#documents(input);
        const schemaIssues = [
            ...validateThemeNames(input),
            ...documents.flatMap((document) => this.#validateSchema(document, options.schema)),
        ];
        if (schemaIssues.length > 0 || options.scope === CheckScope.SCHEMA) {
            return schemaIssues;
        }

        let list: DtcgList;
        try {
            list = this.#parseList(input);
        } catch (error) {
            const source = error instanceof BrowserDocumentError ? error.source : input.base.source;
            return [toSyntaxIssue(source, error)];
        }

        const scope = options.scope ?? CheckScope.VALIDATE;
        const layers = options.layers?.length ? new TokenLayers([...options.layers]) : TokenLayers.default();
        const validationIssues = scope.includes(CheckScope.VALIDATE)
            ? runChecks(validationChecks(), list, layers, options.checks)
            : [];
        if (hasErrors(validationIssues) || !scope.includes(CheckScope.LINT)) {
            return validationIssues;
        }

        return [
            ...validationIssues,
            ...runChecks(lintingChecks(), list, layers, options.checks),
        ];
    }

    convert(
        input: BrowserTokenSet,
        format: BrowserOutputFormat,
        options: BrowserCheckOptions = {},
    ): BrowserTokenOutput[] {
        const issues = this.check(input, { ...options, scope: CheckScope.VALIDATE });
        if (hasErrors(issues)) {
            throw new BrowserTokenValidationError(issues);
        }

        try {
            return this.#convertList(this.#parseList(input), format);
        } catch (error) {
            throw toValidationError(error);
        }
    }

    stats(input: BrowserTokenSet, options: BrowserCheckOptions = {}): readonly TokenStat[] {
        const issues = this.check(input, { ...options, scope: CheckScope.VALIDATE });
        if (hasErrors(issues)) {
            throw new BrowserTokenValidationError(issues);
        }
        try {
            return new TokenStatsCalculator().calculate(this.#parseList(input));
        } catch (error) {
            throw toValidationError(error);
        }
    }

    #convertList(list: DtcgList, format: BrowserOutputFormat): BrowserTokenOutput[] {
        switch (format) {
            case Format.DTCG:
                return documentOutputs(list, "json", (document) => new DtcgJsonWriter().write(document));
            case Format.HRDT:
                return documentOutputs(list, "yaml", (document) => new HrdtTokenWriter().write(document));
            case Format.DESIGN_MD:
                return documentOutputs(
                    new DtcgToDesignMdMapper().map(list),
                    "md",
                    (document) => new DesignMdWriter().write(document),
                );
            case Format.CSS:
                return [{ fileName: "tokens.css", content: new CssTokenConverter().convertList(list) }];
            case Format.SCSS:
                return new ScssTokenConverter().convertThemeList(list).map((output) => ({
                    fileName: `tokens.${output.themeName}.scss`,
                    content: output.content,
                    themeName: output.themeName,
                }));
            case Format.TAILWIND_V4:
                return [{ fileName: "tokens.tailwind.css", content: new TailwindTokenConverter().convertList(list) }];
            case Format.SWIFT_UI:
                return [{ fileName: "DesignTokens.swift", content: new SwiftUiTokenConverter().convertList(list) }];
            case Format.FIGMA_SCRIPT:
                return [{ fileName: "tokens.figma.js", content: new FigmaScriptTokenConverter().convertList(list) }];
            case Format.ANDROID:
                return new AndroidTokenConverter().convertResourceList(list).map((output) => ({
                    fileName: output.filePath,
                    content: output.content,
                    themeName: output.themeName,
                }));
            case "showcase": {
                const parsedCss = new CssTokenParser().parse(new CssTokenConverter().convertList(list));
                return [{
                    fileName: "showcase.html",
                    content: new TokenHtmlShowcaseRenderer().renderPage(withBaseTheme(parsedCss)),
                }];
            }
        }
    }

    #parseList(input: BrowserTokenSet): DtcgList {
        const [base, ...embeddedThemes] = this.#parseDocuments(input.base);
        if (base === undefined) {
            throw new BrowserDocumentError(input.base.source, "Token source contains no documents.");
        }
        const themes = new Map<string, Dtcg>();
        embeddedThemes.forEach((document, index) => themes.set(`theme-${index + 1}`, document));
        for (const [name, document] of Object.entries(input.themes ?? {})) {
            const documents = this.#parseDocuments(document);
            documents.forEach((parsed, index) => {
                themes.set(index === 0 ? name : `${name}-${index + 1}`, parsed);
            });
        }
        return new DtcgList(base, themes);
    }

    #parseDocuments(document: BrowserTokenDocument): Dtcg[] {
        try {
            const format = detectFormat(document);
            const source = document.source;
            if (format === Format.DTCG) return [new DtcgJsonReader().parse(document.content, source)];
            if (format === Format.HRDT) return new HrdtTokenParser().parseAll(document.content, source);
            return [new DesignMdReader().parse(document.content, source)];
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to parse token content.";
            throw new BrowserDocumentError(document.source, message);
        }
    }

    #documents(input: BrowserTokenSet): BrowserTokenDocument[] {
        return [input.base, ...Object.values(input.themes ?? {})];
    }

    #validateSchema(document: BrowserTokenDocument, schemaName?: BrowserDtcgSchema): CheckIssue[] {
        try {
            const format = detectFormat(document);
            const source = document.source ?? "browser-input";
            if (format === Format.DTCG) {
                const content = addInheritedTokenTypes(JSON.parse(document.content) as unknown);
                return validateWithAjv(createDtcgAjv(schemaName), DTCG_SCHEMA_ID, content, source);
            }
            if (format === Format.HRDT) {
                const ajv = createAjv([hrdtSchema]);
                return new HrdtTokenParser().parseAllRaw(document.content).flatMap((value) => (
                    validateWithAjv(ajv, hrdtSchema.$id ?? "hrdt", value, source)
                ));
            }
            const reader = new DesignMdReader();
            const issues = validateWithAjv(
                createAjv([designMdSchema]),
                designMdSchema.$id ?? "design-md",
                reader.parseRaw(document.content),
                source,
            );
            if (issues.length === 0) reader.parse(document.content, source);
            return issues;
        } catch (error) {
            return [toSyntaxIssue(document.source, error)];
        }
    }
}

type JsonSchema = { readonly $id?: string; readonly [key: string]: unknown };

class BrowserDocumentError extends Error {
    readonly source: string | undefined;

    constructor(source: string | undefined, message: string) {
        super(message);
        this.name = "BrowserDocumentError";
        this.source = source;
    }
}

function createDtcgAjv(schemaName: BrowserDtcgSchema = "2025.10"): Ajv {
    const prefix = `/schemas/${schemaName}/`;
    const schemas = Object.entries(DTCG_SCHEMAS)
        .filter(([path]) => path.replaceAll("\\", "/").includes(prefix))
        .map(([, schema]) => schema);
    return createAjv(schemas);
}

function createAjv(schemas: readonly JsonSchema[]): Ajv {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    for (const schema of schemas) {
        ajv.addSchema(schema, schema.$id);
    }
    return ajv;
}

function validateWithAjv(ajv: Ajv, schemaId: string, value: unknown, sourcePath: string): CheckIssue[] {
    const validator = ajv.getSchema(schemaId);
    if (validator === undefined) {
        throw new Error(`AJV schema "${schemaId}" was not loaded.`);
    }
    if (validator(value)) return [];
    return (validator.errors ?? []).map((error) => toSchemaIssue(sourcePath, error));
}

function runChecks(
    checks: readonly Check[],
    list: DtcgList,
    layers: TokenLayers,
    selectedIds?: readonly string[],
): CheckIssue[] {
    const selected = selectedIds?.length
        ? checks.filter((check) => selectedIds.includes(check.id))
        : checks;
    return new CheckRunner(selected, layers).runList(list);
}

function hasErrors(issues: readonly CheckIssue[]): boolean {
    return issues.some((issue) => issue.severity === "error");
}

function validateThemeNames(input: BrowserTokenSet): CheckIssue[] {
    return Object.keys(input.themes ?? {})
        .filter((name) => !/^[a-zA-Z0-9_-]+$/.test(name))
        .map((name) => ({
            id: "theme-name",
            sourcePath: input.themes?.[name]?.source ?? name,
            severity: "error" as const,
            message: `Invalid theme name "${name}". Use letters, numbers, hyphens, or underscores.`,
        }));
}

function detectFormat(document: BrowserTokenDocument): BrowserInputFormat {
    const detected = document.format ?? FormatDetector.detectWithContentAndFilename(document.content, document.source);
    if (detected !== Format.DTCG && detected !== Format.HRDT && detected !== Format.DESIGN_MD) {
        throw new Error("CSS is an output format and cannot be used as browser token input.");
    }
    return detected;
}

function documentOutputs(
    list: DtcgList,
    extension: string,
    write: (document: DtcgList["base"]) => string,
): BrowserTokenOutput[] {
    const outputs: BrowserTokenOutput[] = [{ fileName: `tokens.${extension}`, content: write(list.base) }];
    for (const [name, document] of list.themes) {
        outputs.push({ fileName: `tokens.${name}.${extension}`, content: write(document), themeName: name });
    }
    return outputs;
}

function toSchemaIssue(sourcePath: string, error: ErrorObject): CheckIssue {
    return {
        id: "schema",
        sourcePath,
        severity: "error",
        message: `${error.instancePath || "/"}: ${error.message ?? "Validation error."}`,
        raw: error,
    };
}

function toSyntaxIssue(source: string | undefined, error: unknown): CheckIssue {
    return {
        id: "schema",
        sourcePath: source ?? "browser-input",
        severity: "error",
        message: error instanceof Error ? error.message : "Unable to parse token content.",
    };
}

function toValidationError(error: unknown): BrowserTokenValidationError {
    if (error instanceof BrowserTokenValidationError) return error;
    const source = error instanceof BrowserDocumentError ? error.source : undefined;
    return new BrowserTokenValidationError([toSyntaxIssue(source, error)]);
}

function withBaseTheme(parsed: ParsedTokenCss): ParsedTokenCss {
    if (parsed.themes.length === 0) return parsed;
    const baseEntries = parsed.entries
        .filter((entry) => entry.themeName === undefined)
        .map((entry) => ({ ...entry, themeName: "base" }));
    if (baseEntries.length === 0) return parsed;
    return {
        entries: [...baseEntries, ...parsed.entries.filter((entry) => entry.themeName !== undefined)],
        themes: [{ name: "base", entries: baseEntries }, ...parsed.themes],
    };
}

function addInheritedTokenTypes(value: unknown, inheritedType?: string): unknown {
    if (!isJsonObject(value)) return value;
    const effectiveType = typeof value["$type"] === "string" ? value["$type"] : inheritedType;
    if ("$value" in value || "$ref" in value) {
        return value["$type"] !== undefined || effectiveType === undefined ? value : { ...value, "$type": effectiveType };
    }

    const normalized: Record<string, unknown> = { ...value };
    if (isJsonObject(value["$root"])) normalized["$root"] = addInheritedTokenTypes(value["$root"], effectiveType);
    for (const [key, child] of Object.entries(value)) {
        if (!key.startsWith("$") && key !== "$root" && isJsonObject(child)) {
            normalized[key] = addInheritedTokenTypes(child, effectiveType);
        }
    }
    return normalized;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
