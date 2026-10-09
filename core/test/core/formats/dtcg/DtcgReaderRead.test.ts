import { describe, it, expect } from "vitest";
import { DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import type { CheckIssue } from "#/core/check/CheckIssue";

async function issuesOf(content: string): Promise<CheckIssue[]> {
    const result = await DtcgReader.noSchema().read(content, "tokens.json");
    if (result.ok) {
        throw new Error("expected the read to fail");
    }
    return result.issues;
}

async function documentsOf(content: string) {
    const result = await DtcgReader.noSchema().read(content, "tokens.json");
    if (!result.ok) {
        throw new Error(`expected the read to succeed, got: ${result.issues.map((i) => i.message).join("; ")}`);
    }
    return result.documents;
}

function color(hex: string): string {
    return `{"colorSpace":"srgb","components":[1,1,1],"alpha":1,"hex":"${hex}"}`;
}

const VALID = `{"primitive":{"color":{"$type":"color","brand":{"$value":${color("#ff0000")}}}}}`;

const TWO_BROKEN_TOKENS = `{"primitive":{"color":{"$type":"color",`
    + `"brand":{"$value":"not-an-object"},`
    + `"ok":{"$value":${color("#ffffff")}},`
    + `"accent":{"$value":[1,2]}}}}`;

describe("DtcgReader.read", () => {
    describe("successful read", () => {
        it("returns the parsed document", async () => {
            expect(await documentsOf(VALID)).toHaveLength(1);
        });

        it("tags the document with its source", async () => {
            expect((await documentsOf(VALID))[0].source).toBe("tokens.json");
        });
    });

    describe("collecting diagnostics", () => {
        it("reports every broken token instead of stopping at the first", async () => {
            expect(await issuesOf(TWO_BROKEN_TOKENS)).toHaveLength(2);
        });

        it("names the token that failed", async () => {
            const paths = (await issuesOf(TWO_BROKEN_TOKENS)).map((issue) => issue.tokenPath?.toString());
            expect(paths).toEqual(["primitive.color.brand", "primitive.color.accent"]);
        });

        it("attaches the source path to every diagnostic", async () => {
            const sources = (await issuesOf(TWO_BROKEN_TOKENS)).map((issue) => issue.sourcePath);
            expect(new Set(sources)).toEqual(new Set(["tokens.json"]));
        });

        it("reports an unknown token type", async () => {
            const [issue] = await issuesOf('{"a":{"$type":"colour","b":{"$value":"x"}}}');
            expect(issue.id).toBe("unknown-token-type");
        });
    });

    describe("syntax errors", () => {
        it("reports malformed JSON as a diagnostic rather than throwing", async () => {
            const [issue] = await issuesOf('{"color": }');
            expect(issue.id).toBe("json-syntax");
        });

        it("reports a root that is not an object", async () => {
            const [issue] = await issuesOf("[1,2]");
            expect(issue.id).toBe("invalid-root");
        });

        it("does not report token problems from malformed JSON", async () => {
            expect(await issuesOf('{"color": }')).toHaveLength(1);
        });
    });
});
