import { Source } from "#/core/io/Source";
import { Format } from "#/core/io/Format";
import { TokenCssConverter } from "#/core/platforms/css/TokenCssConverter";
import { CssTokenParser } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import { TokenValidator } from "#/core/validation/TokenValidator";
import type { CheckIssue } from "#/core/check/CheckIssue";

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
            const source = new Source(sources[0]);
            if (await source.getFormat() === Format.CSS) {
                return this.#renderCss(await source.getContent());
            }
        }

        return this.#showcaseFromSources(sources);
    }

    async #showcaseFromSources(sources: string[]): Promise<string> {
        const issues = await this.#validator.validate(sources);
        if (this.#hasValidationErrors(issues)) {
            throw new Error(this.#formatCheckIssues(issues));
        }

        const cssString = await this.#converter.convert(sources);
        return this.#renderCss(cssString);
    }

    #renderCss(cssString: string): string {
        return this.#renderer.renderPage(this.#parser.parse(cssString));
    }

    #hasValidationErrors(issues: CheckIssue[]): boolean {
        return issues.some((issue) => issue.severity === "error");
    }

    #formatCheckIssues(issues: CheckIssue[]): string {
        return issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `[${issue.id}] ${issue.sourcePath} - ${issue.message}`)
            .join("\n");
    }

}
