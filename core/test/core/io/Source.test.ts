import { describe, expect, it, vi, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Source } from "#/core/io/Source";
import { Format } from "#/core/io/Format";

const YAML_FIXTURE = fileURLToPath(new URL("Source.test.yaml", import.meta.url));
const CSS_CONTENT = ":root { --color-brand: #fff; }";
const JSON_CONTENT = '{ "color": { "$type": "color", "$value": "#fff" } }';

describe("Source", () => {
    it("throws when the file does not exist", () => {
        expect(() => new Source("no/such/file.yaml")).toThrow(
            'File not found: "no/such/file.yaml"',
        );
    });

    it("returns content without the prefix for a content: source", async () => {
        const source = new Source("content:key: value");

        await expect(source.getContent()).resolves.toBe("key: value");
    });

    // Reads an actual file from disk; the file lives next to this test as
    // Source.test.yaml (paired by name).
    it("reads an existing absolute file path", async () => {
        const filePath = fileURLToPath(new URL("Source.test.yaml", import.meta.url));

        await expect(new Source(filePath).getContent()).resolves.toBe(
            readFileSync(filePath, "utf8"),
        );
    });

    describe("constructor - source type detection", () => {
        it("accepts '-' as stdin source without throwing", () => {
            expect(() => new Source("-")).not.toThrow();
        });

        it("accepts content: prefix without throwing", () => {
            expect(() => new Source("content:hello")).not.toThrow();
        });

        it("accepts existing file path without throwing", () => {
            expect(() => new Source(YAML_FIXTURE)).not.toThrow();
        });

        it("accepts a valid URL without throwing", () => {
            expect(() => new Source("https://example.com/tokens.json")).not.toThrow();
        });

        it("throws with descriptive message for missing file", () => {
            expect(() => new Source("missing/file.json")).toThrow('File not found: "missing/file.json"');
        });
    });

    describe("getInput", () => {
        it("returns the original input string", () => {
            expect(new Source("content:hello").getInput()).toBe("content:hello");
        });
    });

    describe("getContent - content: source", () => {
        it("strips content: prefix", async () => {
            const source = new Source("content:{ }");
            expect(await source.getContent()).toBe("{ }");
        });

        it("returns empty string after prefix when prefix is the whole input", async () => {
            const source = new Source("content:");
            expect(await source.getContent()).toBe("");
        });

        it("caches content on second call", async () => {
            const source = new Source("content:data");
            const first = await source.getContent();
            const second = await source.getContent();
            expect(first).toBe(second);
        });
    });

    describe("getContent - file source", () => {
        it("reads file content from disk", async () => {
            const content = await new Source(YAML_FIXTURE).getContent();
            expect(content).toContain("primitive");
        });

        it("caches file content on second call", async () => {
            const source = new Source(YAML_FIXTURE);
            const first = await source.getContent();
            const second = await source.getContent();
            expect(first).toBe(second);
        });
    });

    describe("getContent - url source", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("reads content from a URL", async () => {
            const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON_CONTENT));

            const content = await new Source("https://example.com/tokens.json").getContent();

            expect(content).toBe(JSON_CONTENT);
            expect(fetchMock).toHaveBeenCalledWith("https://example.com/tokens.json");
        });

        it("throws when URL response is not ok", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 404 }));

            await expect(new Source("https://example.com/missing.json").getContent()).rejects.toThrow(
                'Unable to fetch "https://example.com/missing.json": HTTP 404',
            );
        });

        it("writes fetched URL content to a temp file", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON_CONTENT));

            const filePath = await new Source("https://example.com/tokens.json").getFile();

            expect(existsSync(filePath)).toBe(true);
            expect(readFileSync(filePath, "utf8")).toBe(JSON_CONTENT);
        });
    });

    describe("getFormat", () => {
        it("detects CSS format for CSS content", async () => {
            const format = await new Source(`content:${CSS_CONTENT}`).getFormat();
            expect(format).toBe(Format.CSS);
        });

        it("detects DTCG format for JSON content", async () => {
            const format = await new Source(`content:${JSON_CONTENT}`).getFormat();
            expect(format).toBe(Format.DTCG);
        });

        it("detects HRDT format for YAML file by content", async () => {
            const format = await new Source(YAML_FIXTURE).getFormat();
            expect(format).toBe(Format.HRDT);
        });

        it("caches format on second call", async () => {
            const source = new Source(`content:${CSS_CONTENT}`);
            const first = await source.getFormat();
            const second = await source.getFormat();
            expect(first).toBe(second);
        });
    });

    describe("getFile", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("returns the original path for a file source", async () => {
            const filePath = await new Source(YAML_FIXTURE).getFile();
            expect(filePath).toBe(YAML_FIXTURE);
        });

        it("writes a temp file for content: source and returns its path", async () => {
            const filePath = await new Source("content:hello").getFile();
            expect(existsSync(filePath)).toBe(true);
            expect(readFileSync(filePath, "utf8")).toBe("hello");
        });

        it("returns same temp file path on second call", async () => {
            const source = new Source("content:hello");
            const first = await source.getFile();
            const second = await source.getFile();
            expect(first).toBe(second);
        });

        it("temp file path is in the system temp directory", async () => {
            const { tmpdir } = await import("node:os");
            const filePath = await new Source("content:data").getFile();
            expect(filePath.startsWith(tmpdir())).toBe(true);
        });
    });
});
