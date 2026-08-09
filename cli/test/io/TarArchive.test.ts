import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createTarArchive } from "#io/TarArchive";

const BLOCK_SIZE = 512;

/** Reads a NUL- or space-terminated header field as text. */
function field(archive: Buffer, block: number, offset: number, length: number): string {
    const start = block * BLOCK_SIZE + offset;
    return archive.subarray(start, start + length).toString("utf8").replace(/[\0 ]+$/, "");
}

describe("createTarArchive", () => {
    it("returns two zero blocks for no entries", () => {
        const archive = createTarArchive([]);
        expect(archive).toEqual(Buffer.alloc(BLOCK_SIZE * 2));
    });

    it("records the entry name and size in the header", () => {
        const archive = createTarArchive([{ name: "tokens.base.scss", content: Buffer.from("$a: 1;", "utf8") }]);

        expect(field(archive, 0, 0, 100)).toBe("tokens.base.scss");
        expect(parseInt(field(archive, 0, 124, 12), 8)).toBe(6);
    });

    it("marks entries as regular ustar files", () => {
        const archive = createTarArchive([{ name: "a.scss", content: Buffer.alloc(0) }]);

        expect(field(archive, 0, 156, 1)).toBe("0");
        expect(field(archive, 0, 257, 6)).toBe("ustar");
        expect(field(archive, 0, 263, 2)).toBe("00");
        expect(parseInt(field(archive, 0, 100, 8), 8)).toBe(0o644);
    });

    it("writes a checksum over the header with its own field blanked", () => {
        const archive = createTarArchive([{ name: "a.scss", content: Buffer.from("x", "utf8") }]);
        const header = Buffer.from(archive.subarray(0, BLOCK_SIZE));
        const stored = parseInt(field(archive, 0, 148, 8), 8);

        header.fill(0x20, 148, 156);
        const expected = header.reduce((sum, value) => sum + value, 0);

        expect(stored).toBe(expected);
    });

    it("pads content to a whole number of blocks", () => {
        const archive = createTarArchive([{ name: "a.scss", content: Buffer.from("x", "utf8") }]);

        // header + one padded content block + two trailing blocks
        expect(archive.length).toBe(BLOCK_SIZE * 4);
        expect(archive.subarray(BLOCK_SIZE + 1, BLOCK_SIZE * 2)).toEqual(Buffer.alloc(BLOCK_SIZE - 1));
    });

    it("keeps block-sized content unpadded", () => {
        const archive = createTarArchive([{ name: "a.scss", content: Buffer.alloc(BLOCK_SIZE, 0x61) }]);

        expect(archive.length).toBe(BLOCK_SIZE * 4);
    });

    it("keeps entries in the given order", () => {
        const archive = createTarArchive([
            { name: "tokens.base.scss", content: Buffer.from("base", "utf8") },
            { name: "tokens.dark.scss", content: Buffer.from("dark", "utf8") },
        ]);

        expect(field(archive, 0, 0, 100)).toBe("tokens.base.scss");
        expect(field(archive, 2, 0, 100)).toBe("tokens.dark.scss");
    });

    it("produces the same bytes for the same entries", () => {
        const entries = [{ name: "a.scss", content: Buffer.from("$a: 1;", "utf8") }];

        expect(createTarArchive(entries)).toEqual(createTarArchive(entries));
    });

    it("unpacks with the system tar", () => {
        const archive = createTarArchive([
            { name: "tokens.base.scss", content: Buffer.from("$a: 1;\n", "utf8") },
            { name: "tokens.dark.scss", content: Buffer.from("$a: 2;\n", "utf8") },
        ]);
        const outDir = resolve(tmpdir(), `dtokens-test-${randomUUID()}`);
        mkdirSync(outDir, { recursive: true });
        try {
            const archiveFile = resolve(outDir, "tokens.tar");
            writeFileSync(archiveFile, archive);

            execFileSync("tar", ["-xf", archiveFile, "-C", outDir]);

            expect(readdirSync(outDir).sort()).toEqual(["tokens.base.scss", "tokens.dark.scss", "tokens.tar"]);
            expect(readFileSync(resolve(outDir, "tokens.base.scss"), "utf8")).toBe("$a: 1;\n");
            expect(readFileSync(resolve(outDir, "tokens.dark.scss"), "utf8")).toBe("$a: 2;\n");
        } finally {
            rmSync(outDir, { recursive: true, force: true });
        }
    });
});
