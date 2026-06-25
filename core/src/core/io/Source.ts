import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { Format } from "#/core/io/Format";
import { FormatDetector } from "#/core/io/FormatDetector";
import { stdin } from "#/core/io/Stdin";

const CONTENT_PREFIX = "content:";

enum SourceType {
    URL = "url",
    FILE = "file",
    CONTENT = "content",
    STDIN = "stdin",
}

/**
 * Data source.
 * Wraps URL, File, stdin ({@code "-"}) or raw content.
 *
 * Raw content must be prefixed with {@code "content:"} to distinguish it
 * from a file path. A non-existent file path that lacks the prefix throws
 * an error.
 *
 * Allows returning any of these data sources as a file.
 * Used in tool implementations to simplify the interface.
 */
export class Source {
    readonly #type: SourceType;
    readonly #input: string;
    #content?: string;
    #format?: Format;
    #filePath?: string;

    constructor(input: string) {
        this.#input = input;

        if (input === "-") {
            this.#type = SourceType.STDIN;
        }
        else if (existsSync(input)) {
            this.#type = SourceType.FILE;
        }
        else if (input.startsWith(CONTENT_PREFIX)) {
            this.#type = SourceType.CONTENT;
        }
        else if (Source.#isUrl(input)) {
            this.#type = SourceType.URL;
        }
        else {
            throw new Error(`File not found: "${input}"`);
        }
    }

    static #isUrl(value: string): boolean {
        try {
            new URL(value);
            return true;
        }
        catch {
            return false;
        }
    }

    getInput(): string {
        return this.#input;
    }

    getType(): SourceType {
        return this.#type;
    }

    async getFormat(): Promise<Format> {
        if (this.#format === undefined) {
            const content = await this.getContent();
            const filename = this.#type === SourceType.FILE ? this.#input : undefined;
            this.#format = FormatDetector.detectWithContentAndFilename(content, filename);
        }
        return this.#format;
    }

    async getContent(): Promise<string> {
        if (this.#content !== undefined) {
            return this.#content;
        }

        if (this.#type === SourceType.STDIN) {
            this.#content = await stdin.get();
        }
        else if (this.#type === SourceType.FILE) {
            this.#content = await readFile(this.#input, "utf8");
        }
        else if (this.#type === SourceType.URL) {
            const response = await fetch(this.#input);
            if (!response.ok) {
                throw new Error(`Unable to fetch "${this.#input}": HTTP ${response.status}`);
            }
            this.#content = await response.text();
        }
        else if (this.#type === SourceType.CONTENT) {
            this.#content = this.#input.slice(CONTENT_PREFIX.length);
        }
        else {
            throw new Error(`Unsupported source type "${this.#type}: ${this.#input}"`);
        }

        return this.#content;
    }

    async getFile(): Promise<string> {
        if (this.#filePath !== undefined) {
            return this.#filePath;
        }

        if (this.#type === SourceType.FILE) {
            this.#filePath = this.#input;
        } else {
            this.#filePath = await Source.#writeTemp(await this.getContent());
        }

        return this.#filePath;
    }

    static async #writeTemp(content: string): Promise<string> {
        const filePath = path.join(tmpdir(), `designtokens-${randomUUID()}.tmp`);
        await writeFile(filePath, content, "utf8");
        return filePath;
    }
}
