import { describe, it, expect } from "vitest";
import { DesignMdReader } from "#/core/formats/design-md/DesignMdReader";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { TypographyValue } from "#/core/model/values/TypographyValue";

function designMd(frontmatter: string): string {
    return `---\n${frontmatter}---\n\n## Colors\n`;
}

async function issuesOf(content: string): Promise<CheckIssue[]> {
    const result = await DesignMdReader.noSchema().read(content, "DESIGN.md");
    if (result.ok) {
        throw new Error("expected the read to fail");
    }
    return result.issues;
}

async function documentsOf(content: string) {
    const result = await DesignMdReader.noSchema().read(content, "DESIGN.md");
    if (!result.ok) {
        throw new Error(`expected the read to succeed, got: ${result.issues.map((i) => i.message).join("; ")}`);
    }
    return result.documents;
}

const VALID = designMd('name: Test\ncolors:\n  brand: "#ff0000"\n');

const BROKEN = designMd(
    'colors:\n  brand: "#ff0000"\n  bad: "not-a-color"\n  lost: 42\n'
    + 'spacing:\n  broken: "10zz"\n',
);

describe("DesignMdReader.read", () => {
    describe("successful read", () => {
        it("returns the parsed document", async () => {
            expect(await documentsOf(VALID)).toHaveLength(1);
        });

        it("tags the document with its source", async () => {
            expect((await documentsOf(VALID))[0].source).toBe("DESIGN.md");
        });
    });

    describe("collecting diagnostics", () => {
        it("reports every broken value instead of stopping at the first", async () => {
            expect(await issuesOf(BROKEN)).toHaveLength(3);
        });

        it("names the token that failed", async () => {
            const paths = (await issuesOf(BROKEN)).map((issue) => issue.tokenPath?.toString());
            expect(paths).toEqual(["colors.bad", "colors.lost", "spacing.broken"]);
        });

        it("reports a value of an unexpected type instead of dropping it", async () => {
            const [issue] = await issuesOf(designMd("colors:\n  lost: 42\n"));
            expect(issue.id).toBe("invalid-value");
            expect(issue.tokenPath?.toString()).toBe("colors.lost");
        });

        it("reads a quoted numeric font weight as a number", async () => {
            const typography = "typography:\n  body:\n    fontFamily: Inter\n    fontSize: 16px\n"
                + "    fontWeight: \"600\"\n    lineHeight: 1.5\n";
            const [document] = await documentsOf(designMd(typography));
            const group = document.get("typography") as TokenGroup;
            const value = (group.get("body") as TypographyToken).value as TypographyValue;
            expect(value.fontWeight).toBe(600);
        });

        it("reports an unknown font weight name", async () => {
            const typography = "typography:\n  body:\n    fontFamily: Inter\n    fontSize: 16px\n"
                + "    fontWeight: regulr\n    lineHeight: 1.5\n";
            const [issue] = await issuesOf(designMd(typography));
            expect(issue.id).toBe("invalid-font-weight");
            expect(issue.message).toContain("regulr");
        });

        // The specification allows the property; the model has no type for it,
        // so the value is dropped with a warning and the document still reads.
        it("warns about an unknown component property rather than failing", async () => {
            const result = await DesignMdReader.noSchema().read(
                designMd("components:\n  button:\n    bogus: 1\n"),
                "DESIGN.md",
            );
            expect(result.ok).toBe(true);
            expect(result.issues).toContainEqual(expect.objectContaining({
                id: "design-md-ignored-value",
                severity: "warning",
            }));
        });
    });

    describe("missing frontmatter", () => {
        it("reports content without frontmatter", async () => {
            const [issue] = await issuesOf("# Just markdown\n");
            expect(issue.id).toBe("missing-frontmatter");
        });
    });
});
