import { Source } from "#/core/io/Source";
import type { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { CssTokenParser } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import { TokenChecker } from "#/core/check/TokenChecker";
import type { CheckIssue } from "#/core/check/CheckIssue";

/**
 * Builds an HTML showcase from JSON tokens or ready CSS.
 *
 * @remarks
 * Implements the common showcase pipeline and gives validation, conversion,
 * CSS parsing and HTML rendering to separate classes.
 */
export class TokenHtmlShowcaseBuilder implements TokenHtmlShowcase {
    readonly #checker: TokenChecker;
    readonly #converter: Pick<CssTokenConverter, "convert">;
    readonly #parser: CssTokenParser;
    readonly #renderer: TokenHtmlShowcaseRenderer;

    constructor(
        checker: TokenChecker,
        converter: Pick<CssTokenConverter, "convert">,
        parser = new CssTokenParser(),
        renderer = new TokenHtmlShowcaseRenderer(),
    ) {
        this.#checker = checker;
        this.#converter = converter;
        this.#parser = parser;
        this.#renderer = renderer;
    }

    async showcase(sources: string[]): Promise<string> {
        if (sources.length === 0) {
            throw new Error("No token sources provided");
        }

        if (sources.length === 1) {
            const content = await new Source(sources[0]).getContent();
            if (CssTokenParser.isCss(content)) {
                return this.#renderCss(content);
            }
        }

        return this.#showcaseFromSources(sources);
    }

    async #showcaseFromSources(sources: string[]): Promise<string> {
        const issues = await this.#checker.check(sources);
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
