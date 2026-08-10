/**
 * Java keywords that cannot be used as resource names, because Android
 * generates a Java field per resource in `R`.
 */
const JAVA_KEYWORDS = new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new",
    "package", "private", "protected", "public", "return", "short", "static",
    "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "try", "void", "volatile", "while", "true", "false", "null",
]);

/**
 * Builds Android resource names from token paths.
 *
 * @remarks
 * Android resource names must be `snake_case`, start with a letter and contain
 * only lower-case letters, digits and underscores. Names colliding with Java
 * keywords are suffixed, because each resource becomes a field in `R`.
 */
export class AndroidResourceNamer {
    /**
     * Builds a resource name from token path segments.
     *
     * @param path - Token path segments.
     * @returns Resource name in `snake_case`.
     */
    name(path: readonly string[]): string {
        const parts = path.flatMap((segment) => this.parts(segment));
        return this.#escape(this.#prefix(parts.join("_")));
    }

    /**
     * Splits one token path segment into normalized lower-case name parts.
     *
     * @param segment - Token path segment.
     * @returns Lower-case parts without separators.
     */
    parts(segment: string): string[] {
        return segment
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .split(/[-_.\s]+/)
            .filter(Boolean)
            .map((part) => part.toLowerCase().replace(/[^a-z0-9]/g, ""))
            .filter(Boolean);
    }

    #prefix(name: string): string {
        return /^[a-z]/.test(name) ? name : `token_${name}`;
    }

    #escape(name: string): string {
        return JAVA_KEYWORDS.has(name) ? `${name}_` : name;
    }
}
