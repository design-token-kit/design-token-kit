import { describe, it, expect } from "vitest";
import { HrdtReader } from "#/core/formats/hrdt/HrdtReader";
import type { CheckIssue } from "#/core/check/CheckIssue";

async function read(content: string, source = "tokens.yaml") {
    return HrdtReader.noSchema().read(content, source);
}

async function issuesOf(content: string): Promise<CheckIssue[]> {
    const result = await read(content);
    if (result.ok) {
        throw new Error("expected the read to fail");
    }
    return result.issues;
}

async function documentsOf(content: string) {
    const result = await read(content);
    if (!result.ok) {
        throw new Error(`expected the read to succeed, got: ${result.issues.map((i: CheckIssue) => i.message).join("; ")}`);
    }
    return result.documents;
}

const VALID = `primitive:
  color:
    brand: "#ff0000"
`;

const THREE_BROKEN_TOKENS = `primitive:
  color:
    brand: "#GGG"
    ok: "#ffffff"
    accent: "#ZZZ"
  dimension:
    small: "10zz"
`;

describe("HrdtReader.read", () => {
    describe("successful read", () => {
        it("returns the parsed document", async () => {
            expect(await documentsOf(VALID)).toHaveLength(1);
        });

        it("returns one document per YAML document", async () => {
            const content = `${VALID}---\nsemantic:\n  bg: "{primitive.color.brand}"\n`;
            expect(await documentsOf(content)).toHaveLength(2);
        });

        it("tags the document with its source", async () => {
            expect((await documentsOf(VALID))[0].source).toBe("tokens.yaml");
        });
    });

    describe("collecting diagnostics", () => {
        it("reports every broken token instead of stopping at the first", async () => {
            expect(await issuesOf(THREE_BROKEN_TOKENS)).toHaveLength(3);
        });

        it("names the token that failed", async () => {
            const paths = (await issuesOf(THREE_BROKEN_TOKENS)).map((issue) => issue.tokenPath?.toString());
            expect(paths).toEqual([
                "primitive.color.brand",
                "primitive.color.accent",
                "primitive.dimension.small",
            ]);
        });

        it("points at the line and column of the offending value", async () => {
            const [first] = await issuesOf(THREE_BROKEN_TOKENS);
            expect({ line: first.line, column: first.column }).toEqual({ line: 3, column: 12 });
        });

        it("attaches the source path to every diagnostic", async () => {
            const sources = (await issuesOf(THREE_BROKEN_TOKENS)).map((issue) => issue.sourcePath);
            expect(new Set(sources)).toEqual(new Set(["tokens.yaml"]));
        });

        it("names the token type that was expected in the diagnostic id", async () => {
            expect((await issuesOf(THREE_BROKEN_TOKENS)).map((issue) => issue.id))
                .toEqual(["invalid-color", "invalid-color", "invalid-dimension"]);
        });

        it("reports a literal that is neither a reference nor a recognisable value", async () => {
            const [issue] = await issuesOf("semantic:\n  bg: [1, 2]\n");
            expect(issue.id).toBe("invalid-reference");
            expect(issue.tokenPath?.toString()).toBe("semantic.bg");
        });

        it("reports a broken token in a later document", async () => {
            const content = `${VALID}---\nprimitive:\n  color:\n    other: "#QQQ"\n`;
            const [issue] = await issuesOf(content);
            expect(issue.tokenPath?.toString()).toBe("primitive.color.other");
            expect(issue.line).toBe(7);
        });

        it("reports an unknown primitive token type", async () => {
            const [issue] = await issuesOf('primitive:\n  colour:\n    a: "#ffffff"\n');
            expect(issue.id).toBe("unknown-token-type");
            expect(issue.tokenPath?.toString()).toBe("primitive.colour");
        });
    });

    describe("syntax errors", () => {
        it("reports the YAML error with its position", async () => {
            const [issue] = await issuesOf('primitive:\n  color:\n    a: "#ffffff"\n  bad: [unclosed\n');
            expect(issue.id).toBe("yaml-bad-indent");
            expect(issue.line).toBe(5);
        });

        it("does not report token problems from a broken tree", async () => {
            const issues = await issuesOf('primitive:\n  color:\n    a: "#fff"\n  bad: [unclosed\n');
            expect(issues).toHaveLength(1);
            expect(issues[0].id).toBe("yaml-bad-indent");
        });

        it("reports a root that is not an object", async () => {
            const [issue] = await issuesOf("- just\n- a list\n");
            expect(issue.id).toBe("invalid-root");
        });
    });
});
