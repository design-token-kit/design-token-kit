import { describe, expect, it } from "vitest";
import { DtcgListLoader, TokenSyntaxError } from "#/figma-plugin/core-adapter/DtcgListLoader";

describe("DtcgListLoader", () => {
    it("rejects file-source loading in the plugin runtime", async () => {
        await expect(new DtcgListLoader().load(["tokens.json"]))
            .rejects.toThrow("File-source token loading is unavailable in the Figma plugin.");
    });
});

describe("TokenSyntaxError", () => {
    it("formats compatibility issues for core imports", () => {
        const error = new TokenSyntaxError([{
            id: "invalid-token",
            sourcePath: "tokens.json",
            message: "Token is invalid",
            severity: "error",
        }]);

        expect(error.name).toBe("TokenSyntaxError");
        expect(error.formatIssues()).toBe("[invalid-token] tokens.json - Token is invalid");
    });
});
