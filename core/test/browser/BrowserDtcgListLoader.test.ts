import { describe, expect, it } from "vitest";
import { DtcgListLoader, TokenSyntaxError } from "#/browser/BrowserDtcgListLoader";

describe("browser DTCG list loader", () => {
    it("rejects file-source loading", async () => {
        await expect(new DtcgListLoader("2025.10").load(["tokens.json"]))
            .rejects.toThrow("File-source token loading is unavailable in the browser entry.");
    });

    it("formats compatibility syntax issues", () => {
        const error = new TokenSyntaxError([
            { id: "schema", sourcePath: "tokens.json", message: "Invalid document.", severity: "error" },
            { id: "parser", sourcePath: "tokens.yaml", message: "Invalid YAML.", severity: "error" },
        ]);

        expect(error.name).toBe("TokenSyntaxError");
        expect(error.formatIssues()).toBe(
            "[schema] tokens.json - Invalid document.\n[parser] tokens.yaml - Invalid YAML.",
        );
    });
});
