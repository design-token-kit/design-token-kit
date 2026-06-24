import { Format } from "#/core/io/Format";
import { DesignMdReader } from "#/core/io/DesignMdReader";

/**
 * Detects the token format from raw content by inspecting the content
 * structure rather than relying on file extensions.
 *
 * Supported formats: {@link Format.DTCG} (JSON), {@link Format.HRDT} (YAML),
 * {@link Format.DESIGN_MD} (DESIGN.md markdown), and {@link Format.CSS}.
 */
export class FormatDetector {

    /**
     * Detects the format of the given content.
     *
     * Detection rules:
     * - If content starts with `{` and is valid JSON it is treated as DTCG.
     * - If content contains CSS-specific patterns (`:root`, custom properties,
     *   `@layer`) it is treated as CSS.
     * - If content starts with `---` (YAML frontmatter) followed by markdown
     *   prose it is treated as DESIGN.md.
     * - Otherwise it is treated as HRDT.
     */
    static detect(content: string): Format {
        const trimmed = content.trimStart();

        if (trimmed.length === 0) {
            return Format.HRDT;
        }

        if (FormatDetector.isDtcg(trimmed)) {
            return Format.DTCG;
        }

        if (FormatDetector.isCss(trimmed)) {
            return Format.CSS;
        }

        if (FormatDetector.isDesignMd(trimmed)) {
            return Format.DESIGN_MD;
        }

        return Format.HRDT;
    }

    /**
     * Returns `true` when the content looks like a DTCG JSON document.
     *
     * The check is structural: content must start with `{` and be parseable
     * as JSON.
     */
    static isDtcg(content: string): boolean {
        if (!content.startsWith("{")) {
            return false;
        }
        try {
            JSON.parse(content);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Returns `true` when the content looks like CSS.
     *
     * Detects the presence of CSS custom properties (`--name:`),
     * {@code :root} selector, or {@code @layer} at-rules.
     */
    static isCss(content: string): boolean {
        return /(^|\s)--[a-zA-Z0-9_-]+\s*:/.test(content)
            || /(^|\s):root\b/.test(content)
            || /(^|\s)@layer\b/.test(content);
    }

    /**
     * Returns `true` when the content looks like a DESIGN.md file.
     *
     * Delegates to {@link DesignMdReader.isDesignMd}.
     */
    static isDesignMd(content: string): boolean {
        return DesignMdReader.isDesignMd(content);
    }

    /**
     * Detects format from content with an optional filename hint for
     * disambiguating DESIGN.md from HRDT YAML when both start with
     * {@code ---}.
     *
     * When the filename ends with {@code .md} and the content starts with
     * {@code ---}, the format is resolved as DESIGN.md even when the content
     * alone would be ambiguous.
     */
    static detectWithContentAndFilename(content: string, filename?: string): Format {
        const trimmed = content.trimStart();
        const contentStartsWithDash = trimmed.startsWith("---");

        if (contentStartsWithDash && filename && /\.md$/i.test(filename)) {
            return Format.DESIGN_MD;
        }
        if (contentStartsWithDash && filename && /\.(ya?ml)$/i.test(filename)) {
            return Format.HRDT;
        }

        return this.detect(content);
    }
}
