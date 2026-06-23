import { describe, it, expect } from "vitest";
import { dtokens, fixturePath } from "./_shared";

// Subprocess only: help text, unknown-command handling and OS exit codes
// exercise argv parsing and the assembled `program` in index.ts, which cannot
// be reproduced by invoking a single command in-process.
describe("integration", () => {

describe("help", () => {
    it("shows exit codes in validate help", () => {
        const result = dtokens("validate --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("validation errors found");
    });

    it("shows exit codes in check help", () => {
        const result = dtokens("check --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("issues found");
    });

    it("documents the scope option in check help", () => {
        const result = dtokens("check --help");
        expect(result.stdout).toContain("--scope");
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

    it("shows exit codes in stats help", () => {
        const result = dtokens("stats --help");
        expect(result.stdout).toContain("Exit status:");
        expect(result.stdout).toContain("stats failed");
    });
});

describe("unknown command", () => {
    it("fails with a non-zero exit code", () => {
        const result = dtokens(`lint ${fixturePath("valid.json")}`);
        expect(result.status).not.toBe(0);
    });

    it("reports the unknown command", () => {
        const result = dtokens("lint -");
        expect(result.stderr).toContain("unknown command");
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

    it("returns 1 on stats failure", () => {
        const result = dtokens("stats -", "bad");
        expect(result.status).toBe(1);
    });
});

});
