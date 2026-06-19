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
});
