import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Stdin } from "#/core/io/Stdin";

describe("Stdin", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("hasData", () => {
        it("returns false when stdin is a TTY", () => {
            Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
            expect(new Stdin().hasData()).toBe(false);
        });

        it("returns true when stdin is not a TTY", () => {
            Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
            expect(new Stdin().hasData()).toBe(true);
        });
    });

    describe("get - TTY (no data)", () => {
        beforeEach(() => {
            Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
        });

        it("throws when stdin is a TTY", async () => {
            await expect(new Stdin().get()).rejects.toThrow("Cannot read from stdin");
        });
    });

    describe("get - piped data", () => {
        beforeEach(() => {
            Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
        });

        it("reads and returns piped content", async () => {
            const chunks = [Buffer.from("hello "), Buffer.from("world")];
            vi.spyOn(process.stdin, Symbol.asyncIterator as never).mockImplementation(async function* () {
                for (const chunk of chunks) yield chunk;
            } as never);

            const result = await new Stdin().get();
            expect(result).toBe("hello world");
        });

        it("returns cached content on second call without re-reading the stream", async () => {
            const iterator = vi.fn(async function* () {
                yield Buffer.from("data");
            });
            vi.spyOn(process.stdin, Symbol.asyncIterator as never).mockImplementation(iterator as never);

            const instance = new Stdin();
            await instance.get();
            await instance.get();

            expect(iterator).toHaveBeenCalledTimes(1);
        });

        it("throws when piped stream is empty", async () => {
            vi.spyOn(process.stdin, Symbol.asyncIterator as never).mockImplementation(async function* () {
                // yields nothing
            } as never);

            await expect(new Stdin().get()).rejects.toThrow("stream ended without data");
        });

        it("handles string chunks in addition to Buffer chunks", async () => {
            vi.spyOn(process.stdin, Symbol.asyncIterator as never).mockImplementation(async function* () {
                yield "string chunk";
            } as never);

            const result = await new Stdin().get();
            expect(result).toBe("string chunk");
        });
    });
});
