import { describe, it, expect, vi } from "vitest";
import { TokenHtmlShowcaseBuilder } from "#/core/showcase/TokenHtmlShowcaseBuilder";
import type { TokenValidator } from "#/core/validation/TokenValidator";
import type { TokenCssConverter } from "#/core/platforms/css/TokenCssConverter";
import type { CssTokenParser } from "#/core/showcase/CssTokenParser";
import type { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import type { CheckIssue } from "#/core/check/CheckIssue";

function makeBuilder(overrides: {
    issues?: CheckIssue[];
    css?: string;
    parsedHtml?: string;
} = {}): TokenHtmlShowcaseBuilder {
    const validator: TokenValidator = {
        validate: vi.fn().mockResolvedValue(overrides.issues ?? []),
    };

    const converter: TokenCssConverter = {
        convert: vi.fn().mockResolvedValue(overrides.css ?? ":root { --color-brand: #fff; }"),
    };

    const parsedResult = { entries: [], themes: [] };
    const parser = {
        parse: vi.fn().mockReturnValue(parsedResult),
    } as unknown as CssTokenParser;

    const renderer = {
        renderPage: vi.fn().mockReturnValue(overrides.parsedHtml ?? "<html>showcase</html>"),
    } as unknown as TokenHtmlShowcaseRenderer;

    return new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer);
}

function issue(severity: "error" | "warning", message: string, id = "test-id"): CheckIssue {
    return { id, message, severity, sourcePath: "tokens.json" };
}

describe("TokenHtmlShowcaseBuilder", () => {
    describe("showcase - empty sources", () => {
        it("throws when no sources provided", async () => {
            const builder = makeBuilder();
            await expect(builder.showcase([])).rejects.toThrow("No token sources provided");
        });
    });

    // When a single source is provided, Builder checks the file on disk to detect CSS format.
    // Use two sources to force the #showcaseFromSources path (validator → converter → parser → renderer).
    const SOURCES = ["tokens.json", "tokens.dark.json"];

    describe("showcase - JSON sources", () => {
        it("validates sources before converting", async () => {
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn().mockReturnValue({ entries: [], themes: [] }) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html/>") } as unknown as TokenHtmlShowcaseRenderer;

            await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(validator.validate).toHaveBeenCalledWith(SOURCES);
        });

        it("converts sources to CSS when validation passes", async () => {
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn().mockReturnValue({ entries: [], themes: [] }) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html/>") } as unknown as TokenHtmlShowcaseRenderer;

            await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(converter.convert).toHaveBeenCalledWith(SOURCES);
        });

        it("parses the CSS returned by converter", async () => {
            const css = ":root { --color-brand: #fff; }";
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(css) };
            const parser = { parse: vi.fn().mockReturnValue({ entries: [], themes: [] }) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html/>") } as unknown as TokenHtmlShowcaseRenderer;

            await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(parser.parse).toHaveBeenCalledWith(css);
        });

        it("renders HTML from parsed CSS and returns it", async () => {
            const parsedResult = { entries: [{ name: "--color-brand", value: "#fff", scope: "primitive" }], themes: [] };
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn().mockReturnValue(parsedResult) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html>ok</html>") } as unknown as TokenHtmlShowcaseRenderer;

            const result = await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(renderer.renderPage).toHaveBeenCalledWith(parsedResult);
            expect(result).toBe("<html>ok</html>");
        });

        it("throws when validation returns errors", async () => {
            const builder = makeBuilder({ issues: [issue("error", "Bad reference to missing token")] });
            await expect(builder.showcase(SOURCES)).rejects.toThrow("Bad reference to missing token");
        });

        it("error message includes issue id and source path", async () => {
            const builder = makeBuilder({ issues: [issue("error", "Missing token", "bad-reference")] });
            await expect(builder.showcase(SOURCES)).rejects.toThrow("[bad-reference] tokens.json - Missing token");
        });

        it("error message includes all errors when multiple errors", async () => {
            const builder = makeBuilder({
                issues: [
                    issue("error", "First error", "err-1"),
                    issue("error", "Second error", "err-2"),
                ],
            });

            let message = "";
            try {
                await builder.showcase(SOURCES);
            } catch (e) {
                message = (e as Error).message;
            }

            expect(message).toContain("First error");
            expect(message).toContain("Second error");
        });

        it("does not throw when validation returns only warnings", async () => {
            const builder = makeBuilder({ issues: [issue("warning", "Unused token")] });
            await expect(builder.showcase(SOURCES)).resolves.toBeDefined();
        });

        it("does not convert when validation has errors", async () => {
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([issue("error", "Bad token")]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn() } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn() } as unknown as TokenHtmlShowcaseRenderer;

            try {
                await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);
            } catch {
                // expected
            }

            expect(converter.convert).not.toHaveBeenCalled();
        });
    });

    describe("showcase - two JSON sources", () => {
        it("passes all sources to validator", async () => {
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn().mockReturnValue({ entries: [], themes: [] }) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html/>") } as unknown as TokenHtmlShowcaseRenderer;

            await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(validator.validate).toHaveBeenCalledWith(SOURCES);
        });

        it("passes all sources to converter", async () => {
            const validator: TokenValidator = { validate: vi.fn().mockResolvedValue([]) };
            const converter: TokenCssConverter = { convert: vi.fn().mockResolvedValue(":root {}") };
            const parser = { parse: vi.fn().mockReturnValue({ entries: [], themes: [] }) } as unknown as CssTokenParser;
            const renderer = { renderPage: vi.fn().mockReturnValue("<html/>") } as unknown as TokenHtmlShowcaseRenderer;

            await new TokenHtmlShowcaseBuilder(validator, converter, parser, renderer).showcase(SOURCES);

            expect(converter.convert).toHaveBeenCalledWith(SOURCES);
        });
    });
});
