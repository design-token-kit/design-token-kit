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
import { CssTokenParser } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import { TokenStatsCalculator, type TokenStat } from "#/core/stats/TokenStatsCalculator";
import { DesignMdContentValidator } from "#/core/validation/design-md/DesignMdContentValidator";
import { DtcgContentValidator } from "#/core/validation/dtcg/DtcgContentValidator";
import { HrdtContentValidator } from "#/core/validation/hrdt/HrdtContentValidator";
import { syntaxIssue, type JsonSchema } from "#/core/validation/SchemaValidation";

import designMdSchema from "#/core/validation/design-md/schemas/design-md-tokens.json";
import hrdtSchema from "#/core/validation/hrdt/schemas/hrdt-tokens.json";

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
 *
 * @experimental The browser API may change in minor releases.
 */
export class BrowserTokenToolkit {

    check(input: BrowserTokenSet, options: BrowserCheckOptions = {}): CheckIssue[] {
        return this.#analyze(input, options).issues;
    }

    convert(
        input: BrowserTokenSet,
        format: BrowserOutputFormat,
        options: BrowserCheckOptions = {},
    ): BrowserTokenOutput[] {
        const list = this.#validatedList(input, options);
        try {
            return this.#convertList(list, format);
        } catch (error) {
            throw toValidationError(error);
        }
    }

    stats(input: BrowserTokenSet, options: BrowserCheckOptions = {}): readonly TokenStat[] {
        const list = this.#validatedList(input, options);
        try {
            return new TokenStatsCalculator().calculate(list);
        } catch (error) {
            throw toValidationError(error);
        }
    }

    /**
     * Runs the check pipeline and keeps the parsed list, so callers that
     * continue after validation do not parse the documents again.
     */
    #analyze(input: BrowserTokenSet, options: BrowserCheckOptions): { issues: CheckIssue[]; list?: DtcgList } {
        const documents = this.#documents(input);
        const schemaIssues = [
            ...validateThemeNames(input),
            ...documents.flatMap((document) => this.#validateSchema(document, options.schema)),
        ];
        if (hasErrors(schemaIssues) || options.scope === CheckScope.SCHEMA) {
            return { issues: schemaIssues };
        }

        let list: DtcgList;
        try {
            list = this.#parseList(input);
        } catch (error) {
            return { issues: [toDocumentIssue(error, input.base.source)] };
        }

        const scope = options.scope ?? CheckScope.VALIDATE;
        const layers = options.layers?.length ? new TokenLayers([...options.layers]) : TokenLayers.default();
        const validationIssues = [
            ...schemaIssues,
            ...(scope.includes(CheckScope.VALIDATE) ? runChecks(validationChecks(), list, layers, options.checks) : []),
        ];
        if (hasErrors(validationIssues) || !scope.includes(CheckScope.LINT)) {
            return { issues: validationIssues, list };
        }

        return {
            issues: [
                ...validationIssues,
                ...runChecks(lintingChecks(), list, layers, options.checks),
            ],
            list,
        };
    }

    #validatedList(input: BrowserTokenSet, options: BrowserCheckOptions): DtcgList {
        const { issues, list } = this.#analyze(input, { ...options, scope: CheckScope.VALIDATE });
        if (list === undefined || hasErrors(issues)) {
            throw new BrowserTokenValidationError(issues);
        }
        return list;
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
                    content: new TokenHtmlShowcaseRenderer().renderPage(parsedCss),
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
        const addTheme = (name: string, document: Dtcg, source: string | undefined): void => {
            if (themes.has(name)) {
                throw new BrowserDocumentError(
                    source,
                    `Theme name "${name}" is already used by another document. Rename the theme.`,
                    "theme-name",
                );
            }
            themes.set(name, document);
        };
        embeddedThemes.forEach((document, index) => addTheme(`theme-${index + 1}`, document, input.base.source));
        for (const [name, document] of Object.entries(input.themes ?? {})) {
            const source = document.source ?? name;
            const documents = this.#parseDocuments(document);
            if (documents.length === 0) {
                throw new BrowserDocumentError(source, `Theme "${name}" contains no documents.`, "theme-name");
            }
            documents.forEach((parsed, index) => addTheme(index === 0 ? name : `${name}-${index + 1}`, parsed, source));
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

    #validateSchema(document: BrowserTokenDocument, schemaName: BrowserDtcgSchema = "2025.10"): CheckIssue[] {
        const source = document.source ?? "browser-input";
        try {
            const format = detectFormat(document);
            if (format === Format.DTCG) {
                return cached(`dtcg:${schemaName}`, () => new DtcgContentValidator(dtcgSchemas(schemaName)))
                    .validate(document.content, source);
            }
            if (format === Format.HRDT) {
                return cached("hrdt", () => new HrdtContentValidator(hrdtSchema)).validate(document.content, source);
            }
            return cached("design-md", () => new DesignMdContentValidator(designMdSchema))
                .validate(document.content, source);
        } catch (error) {
            return [syntaxIssue(source, error)];
        }
    }
}

class BrowserDocumentError extends Error {
    readonly source: string | undefined;
    readonly issueId: string;

    constructor(source: string | undefined, message: string, issueId = "schema") {
        super(message);
        this.name = "BrowserDocumentError";
        this.source = source;
        this.issueId = issueId;
    }
}

/** Validators are reused because schema compilation dominates a check run. */
const VALIDATORS = new Map<string, unknown>();

function cached<T>(key: string, create: () => T): T {
    if (!VALIDATORS.has(key)) {
        VALIDATORS.set(key, create());
    }
    return VALIDATORS.get(key) as T;
}

function dtcgSchemas(schemaName: BrowserDtcgSchema): JsonSchema[] {
    const prefix = `/schemas/${schemaName}/`;
    return Object.entries(DTCG_SCHEMAS)
        .filter(([path]) => path.replaceAll("\\", "/").includes(prefix))
        .map(([, schema]) => schema);
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

function toDocumentIssue(error: unknown, fallbackSource: string | undefined): CheckIssue {
    if (error instanceof BrowserDocumentError) {
        return syntaxIssue(error.source ?? "browser-input", error, error.issueId);
    }
    return syntaxIssue(fallbackSource ?? "browser-input", error);
}

function toValidationError(error: unknown): BrowserTokenValidationError {
    if (error instanceof BrowserTokenValidationError) return error;
    return new BrowserTokenValidationError([toDocumentIssue(error, undefined)]);
}
