import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Source } from "#/core/io/Source";

describe("Source", () => {
    it("reads an existing absolute file path", async () => {
        const filePath = resolve(__dirname, "../../../tokens/valid.yaml");

        await expect(new Source(filePath).getContent()).resolves.toBe(
            readFileSync(filePath, "utf8"),
        );
    });

    it("throws when the file does not exist", () => {
        expect(() => new Source("core/tokens/valid1.yaml")).toThrow(
            'File not found: "core/tokens/valid1.yaml"',
        );
    });

    it("returns content without the prefix for a content: source", async () => {
        const source = new Source("content:key: value");

        await expect(source.getContent()).resolves.toBe("key: value");
    });
});
