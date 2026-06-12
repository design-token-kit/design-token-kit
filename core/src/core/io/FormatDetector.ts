import { Format } from "#/core/io/Format";

/**
 * Detects the token format from raw content by inspecting the content
 * structure rather than relying on file extensions.
 *
 * Supported formats: {@link Format.DTCG} (JSON), {@link Format.HRDT} (YAML),
 * and {@link Format.CSS}.
 */
export class FormatDetector {

    /**
     * Detects the format of the given content.
     *
     * Detection rules:
     * - If content starts with `{` and is valid JSON it is treated as DTCG.
     * - If content contains CSS-specific patterns (`:root`, custom properties,
     *   `@layer`) it is treated as CSS.
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
}
