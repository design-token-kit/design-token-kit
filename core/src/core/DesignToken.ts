import { readdir } from "node:fs/promises";

function extractFileName(name: string): string {
    return name.split("/").at(-1)?.split("\\").at(-1) ?? name;
}

function extractTheme(fileName: string): string {
    const withoutExt = fileName.replace(/\.json$/i, "");
    const dotIndex = withoutExt.lastIndexOf(".");
    return dotIndex > 0 ? withoutExt.slice(dotIndex + 1) : withoutExt;
}

/**
 * A single design token, identified by file name.
 *
 * @remarks
 * The theme is extracted from the file name:
 * - `tokens.dark.json` → theme `dark`
 * - `base.json` → theme `base`
 * The first token in the {@link DesignTokens} collection is marked as base.
 */
export class DesignToken {
    readonly #isBase: boolean;

    /** Theme name extracted from the file name. */
    readonly themeName: string;

    /**
     * @param name - Path to the token file or its name.
     * @param isBase - Whether the token is base.
     */
    constructor(name: string, isBase: boolean) {
        this.themeName = extractTheme(extractFileName(name));
        this.#isBase = isBase;
    }

    /** Whether the token is base. */
    get isBase(): boolean {
        return this.#isBase;
    }

    /**
     * Token theme name.
     * @deprecated Use {@link DesignToken.themeName}.
     */
    get name(): string {
        return this.themeName;
    }

    /**
     * CSS selector for the token theme.
     * @returns `:root` for base theme, `:root[data-theme="<theme>"]` for others.
     */
    get selector(): string {
        return this.#isBase ? ":root" : `:root[data-theme="${this.themeName}"]`;
    }
}

/**
 * Ordered collection of design tokens.
 *
 * @remarks
 * The first token in the collection is always the base token.
 * Use {@link DesignTokens.fromNames} to create from a list of file names
 * or {@link DesignTokens.scan} to scan a directory.
 */
export class DesignTokens {
    readonly tokens: DesignToken[];

    private constructor(tokens: DesignToken[]) {
        this.tokens = tokens;
    }

    /**
     * Scans a directory and creates a collection from found token files.
     *
     * @param directory - Path to the directory to scan.
     * @returns Collection of tokens sorted by file name.
     * @throws Error if directory is empty.
     */
    static async scan(directory: string): Promise<DesignTokens> {
        const files = (await readdir(directory)).sort();

        const jsonFiles = files.filter((file) => file.toLowerCase().endsWith(".json"));
        if (jsonFiles.length === 0) {
            throw new Error(`No token files found in directory: ${directory}`);
        }

        const tokens = jsonFiles.map(
            (file, index) => new DesignToken(`${directory}/${file}`, index === 0),
        );

        return new DesignTokens(tokens);
    }

    /**
     * Creates a token collection from an array of file names.
     *
     * @param names - Array of token file paths or names.
     *   The first element is considered the base token.
     * @returns Collection of tokens in the order of given names.
     * @throws Error if the array is empty.
     */
    static fromNames(names: string[]): DesignTokens {
        if (names.length === 0) {
            throw new Error("No token sources provided");
        }

        const tokens = names.map(
            (name, index) => new DesignToken(name, index === 0),
        );

        return new DesignTokens(tokens);
    }

    /** Whether the collection has a base token. */
    get hasBaseToken(): boolean {
        return this.tokens.length > 0;
    }

    /** The base token of the collection (first token). */
    get baseToken(): DesignToken {
        return this.tokens[0];
    }

    /**
     * Returns a token by theme name.
     *
     * @param themeName - Theme name (for example, `"dark"`, `"high-contrast"`).
     * @returns Token with the given theme.
     * @throws Error if the token with the given theme is not found.
     */
    getToken(themeName: string): DesignToken {
        const token = this.tokens.find((t) => t.name === themeName);
        if (!token) {
            throw new Error(`Unknown token theme: ${themeName}`);
        }
        return token;
    }

    /**
     * Returns a CSS selector for the given theme.
     *
     * @param themeName - Theme name.
     * @param isBase - Whether the theme is base (`:root`).
     * @returns CSS selector for the theme.
     * @throws Error if the theme is not base and is not found in the collection.
     */
    getSelector(themeName: string, isBase: boolean): string {
        return isBase ? ":root" : this.getToken(themeName).selector;
    }
}
