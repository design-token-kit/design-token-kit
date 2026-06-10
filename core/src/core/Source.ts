import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";

enum SourceType {
    URL = "url",
    FILE = "file",
    CONTENT = "content",
}

/**
 * Data source.
 * Wraps URL, File or content.
 *
 * Allows returning any of these data sources as a file.
 * Used in tool implementations to simplify the interface.
 */
export class Source {
    readonly #type: SourceType;
    readonly #input: string;
    #filePath?: string;

    constructor(input: string) {
        this.#input = input;

        if (Source.#isHttpUrl(input)) {
            this.#type = SourceType.URL;
        } else if (existsSync(input)) {
            this.#type = SourceType.FILE;
        } else {
            this.#type = SourceType.CONTENT;
        }
    }

    static #isHttpUrl(value: string): boolean {
        try {
            const url = new URL(value);

            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    getInput(): string {
        return this.#input;
    }

    getType(): SourceType {
        return this.#type;
    }

    async getContent(): Promise<string> {
        if (this.#type === SourceType.FILE) {
            return readFile(this.#input, "utf8");
        }
        else if (this.#type === SourceType.URL) {
            const response = await fetch(this.#input);
            if (!response.ok) {
                throw new Error(`Unable to fetch "${this.#input}": HTTP ${response.status}`);
            }
            return response.text();
        }
        else if (this.#type === SourceType.CONTENT) { 
            return this.#input;
        }
        else {
            throw new Error(`Unsupported source type "${this.#type}: ${this.#input}"`);
        }
    }

    async getFile(): Promise<string> {
        if (this.#filePath !== undefined) {
            return this.#filePath;
        }

        if (this.#type === SourceType.FILE) {
            this.#filePath = this.#input;
        } else if (this.#type === SourceType.URL) {
            const response = await fetch(this.#input);
            if (!response.ok) {
                throw new Error(`Unable to fetch "${this.#input}": HTTP ${response.status}`);
            }
            this.#filePath = await Source.#writeTemp(await response.text());
        } else {
            this.#filePath = await Source.#writeTemp(this.#input);
        }

        return this.#filePath;
    }

    static async #writeTemp(content: string): Promise<string> {
        const filePath = path.join(tmpdir(), `designtokens-${randomUUID()}.tmp`);
        await writeFile(filePath, content, "utf8");
        return filePath;
    }
}
