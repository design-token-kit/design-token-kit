import { describe, it, expect } from "vitest";
import { dtokens, fixturePath } from "./_shared";

describe("help", () => {
    it("shows exit codes in validate help", () => {
        const result = dtokens("validate --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("validation errors found");
    });

    it("shows exit codes in convert help", () => {
        const result = dtokens("convert --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("conversion failed");
    });

    it("shows exit codes in showcase help", () => {
        const result = dtokens("showcase --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("showcase failed");
    });
});

describe("exit codes", () => {
    it("returns 0 on success", () => {
        const result = dtokens(`validate ${fixturePath("valid.json")}`);
        expect(result.status).toBe(0);
    });

    it("returns 2 on validation errors", () => {
        const result = dtokens("validate -", '{"extra": true}');
        expect(result.status).toBe(2);
    });

    it("returns 1 on conversion failure", () => {
        const result = dtokens("convert - --outform css", "bad");
        expect(result.status).toBe(1);
    });
});
