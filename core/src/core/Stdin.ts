/**
 * Singleton reader for {@code process.stdin}.
 *
 * The underlying stream can only be consumed once per process.
 * After the first call to {@link get} the content is cached and
 * subsequent calls return the cached buffer.
 */
export class Stdin {
    #buffer?: string;

    /**
     * Returns the cached stdin content, or reads the stream on the first
     * call.
     *
     * @throws Error if stdin is a TTY (no data piped).
     */
    async get(): Promise<string> {
        if (this.#buffer === undefined) {
            this.#buffer = await this.#read();
        }
        return this.#buffer;
    }

    /**
     * Returns {@code true} when stdin is piped (not a TTY) and data is
     * available to read.
     */
    hasData(): boolean {
        return !process.stdin.isTTY;
    }

    async #read(): Promise<string> {
        if (!this.hasData()) {
            throw new Error("Cannot read from stdin: no data piped");
        }

        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
        }

        if (chunks.length === 0) {
            throw new Error("Cannot read from stdin: stream ended without data");
        }

        return Buffer.concat(chunks).toString("utf8");
    }
}

export const stdin = new Stdin();
