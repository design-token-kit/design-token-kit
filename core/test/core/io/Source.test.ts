import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Source } from "#/core/io/Source";

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
});
