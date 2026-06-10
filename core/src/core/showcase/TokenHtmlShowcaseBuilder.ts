import { readFile } from "node:fs/promises";
import { TokenCssConverter } from "#/core/css/TokenCssConverter";
import { CssTokenParser } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import { TokenValidator, ValidationIssue } from "#/core/validation/TokenValidator";

/**
 * Builds an HTML showcase from JSON tokens or ready CSS.
 *
 * @remarks
 * Implements the common showcase pipeline and gives validation, conversion,
 * CSS parsing and HTML rendering to separate classes.
 */
export class TokenHtmlShowcaseBuilder implements TokenHtmlShowcase {
    readonly #validator: TokenValidator;
    readonly #converter: TokenCssConverter;
    readonly #parser: CssTokenParser;
    readonly #renderer: TokenHtmlShowcaseRenderer;

    constructor(
        validator: TokenValidator,
        converter: TokenCssConverter,
        parser = new CssTokenParser(),
        renderer = new TokenHtmlShowcaseRenderer(),
    ) {
        this.#validator = validator;
        this.#converter = converter;
        this.#parser = parser;
        this.#renderer = renderer;
    }

    async showcase(sources: string[]): Promise<string> {
        if (sources.length === 0) {
            throw new Error("No token sources provided");
        }

        if (sources.length === 1) {
            const sourceContent = await readFile(sources[0], "utf8");
            if (this.#isCssContent(sourceContent)) {
                return this.#renderCss(sourceContent);
            }
        }

        return this.#showcaseFromSources(sources);
    }

    async #showcaseFromSources(sources: string[]): Promise<string> {
        const issues = await this.#validator.validate(sources);
        if (this.#hasValidationErrors(issues)) {
            throw new Error(this.#formatValidationIssues(issues));
        }

        const cssString = await this.#converter.convert(sources);
        return this.#renderCss(cssString);
    }

    #renderCss(cssString: string): string {
        return this.#renderer.renderPage(this.#parser.parse(cssString));
    }

    #hasValidationErrors(issues: ValidationIssue[]): boolean {
        return issues.some((issue) => issue.severity === "error");
    }

    #formatValidationIssues(issues: ValidationIssue[]): string {
        return issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `[${issue.name}] ${issue.sourcePath} - ${issue.message}`)
            .join("\n");
    }

    #isCssContent(content: string): boolean {
        return /(^|\s)--[a-zA-Z0-9_-]+\s*:/.test(content)
            || /(^|\s):root\b/.test(content)
            || /(^|\s)@layer\b/.test(content);
    }
}
