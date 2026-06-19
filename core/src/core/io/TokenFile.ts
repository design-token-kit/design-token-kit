import { readdir } from "node:fs/promises";

/**
 * A single token file, identified by its name.
 *
 * @remarks
 * The theme is extracted from the file name:
 * - `tokens.dark.json` -> theme `dark`
 * - `base.json` -> theme `base`
 * The first file in the {@link TokenFiles} collection is marked as base.
 */
export class TokenFile {
    readonly #isBase: boolean;

    /** Theme name extracted from the file name. */
    readonly themeName: string;

    /**
     * @param name - Path to the token file or its name.
     * @param isBase - Whether the file is base.
     */
    constructor(name: string, isBase: boolean) {
        this.themeName = TokenFile.#extractTheme(TokenFile.#extractFileName(name));
        this.#isBase = isBase;
    }

    static #extractFileName(name: string): string {
        return name.split("/").at(-1)?.split("\\").at(-1) ?? name;
    }

    static #extractTheme(fileName: string): string {
        const withoutExt = fileName.replace(/\.json$/i, "");
        const dotIndex = withoutExt.lastIndexOf(".");
        return dotIndex > 0 ? withoutExt.slice(dotIndex + 1) : withoutExt;
    }

    /** Whether the file is base. */
    get isBase(): boolean {
        return this.#isBase;
    }

    /**
     * File theme name.
     * @deprecated Use {@link TokenFile.themeName}.
     */
    get name(): string {
        return this.themeName;
    }

    /**
     * CSS selector for the file theme.
     * @returns `:root` for base theme, `:root[data-theme="<theme>"]` for others.
     */
    get selector(): string {
        return this.#isBase ? ":root" : `:root[data-theme="${this.themeName}"]`;
    }
}

/**
 * Ordered collection of token files.
 *
 * @remarks
 * The first file in the collection is always the base file.
 * Use {@link TokenFiles.fromNames} to create from a list of file names
 * or {@link TokenFiles.scan} to scan a directory.
 */
export class TokenFiles {
    readonly files: TokenFile[];

    private constructor(files: TokenFile[]) {
        this.files = files;
    }

    /**
     * Scans a directory and creates a collection from found token files.
     *
     * @param directory - Path to the directory to scan.
     * @returns Collection of files sorted by file name.
     * @throws Error if directory is empty.
     */
    static async scan(directory: string): Promise<TokenFiles> {
        const files = (await readdir(directory)).sort();

        const jsonFiles = files.filter((file) => file.toLowerCase().endsWith(".json"));
        if (jsonFiles.length === 0) {
            throw new Error(`No token files found in directory: ${directory}`);
        }

        const tokenFiles = jsonFiles.map(
            (file, index) => new TokenFile(`${directory}/${file}`, index === 0),
        );

        return new TokenFiles(tokenFiles);
    }

    /**
     * Creates a collection from an array of file names.
     *
     * @param names - Array of token file paths or names.
     *   The first element is considered the base file.
     * @returns Collection of files in the order of given names.
     * @throws Error if the array is empty.
     */
    static fromNames(names: string[]): TokenFiles {
        if (names.length === 0) {
            throw new Error("No token sources provided");
        }

        const tokenFiles = names.map(
            (name, index) => new TokenFile(name, index === 0),
        );

        return new TokenFiles(tokenFiles);
    }

    /** Whether the collection has a base file. */
    get hasBaseToken(): boolean {
        return this.files.length > 0;
    }

    /** The base file of the collection (first file). */
    get baseToken(): TokenFile {
        return this.files[0];
    }

    /**
     * Returns a file by theme name.
     *
     * @param themeName - Theme name (for example, `"dark"`, `"high-contrast"`).
     * @returns File with the given theme.
     * @throws Error if the file with the given theme is not found.
     */
    getToken(themeName: string): TokenFile {
        const file = this.files.find((f) => f.name === themeName);
        if (!file) {
            throw new Error(`Unknown token theme: ${themeName}`);
        }
        return file;
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
