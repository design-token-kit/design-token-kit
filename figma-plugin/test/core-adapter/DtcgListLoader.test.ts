import { describe, expect, it } from "vitest";
import { DtcgListLoader } from "#/figma-plugin/core-adapter/DtcgListLoader";

describe("DtcgListLoader", () => {
    it("rejects file-source loading in the plugin runtime", async () => {
        await expect(new DtcgListLoader().load(["tokens.json"]))
            .rejects.toThrow("File-source token loading is unavailable in the Figma plugin.");
    });

    it("rejects reading sources too", async () => {
        await expect(new DtcgListLoader().read(["tokens.json"]))
            .rejects.toThrow("File-source token loading is unavailable in the Figma plugin.");
    });
});

