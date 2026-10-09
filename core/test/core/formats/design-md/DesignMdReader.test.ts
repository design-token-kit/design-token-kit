import { describe, it, expect } from "vitest";
import { DesignMdReader } from "#/core/formats/design-md/DesignMdReader";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

const SAMPLE = `---
name: Heritage
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
rounded:
  sm: 4px
spacing:
  md: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Test prose.
`;

async function parse(md: string): Promise<Dtcg> {
    const result = await DesignMdReader.noSchema().read(md);
    if (!result.ok) {
        expect.fail(`fixture could not be read:\n${result.issues.map((issue) => issue.message).join("\n")}`);
    }
    return result.documents[0];
}

/** Reads a document expected to fail, returning its diagnostics. */
async function issuesOf(md: string): Promise<string[]> {
    const result = await DesignMdReader.noSchema().read(md);
    if (result.ok) {
        expect.fail("expected the read to fail");
    }
    return result.issues.map((issue) => issue.id);
}

function getGroup(doc: Dtcg, ...path: string[]): TokenGroup {
    let node: ReturnType<Dtcg["get"]> = doc.get(path[0]);
    for (const key of path.slice(1)) {
        node = (node as TokenGroup).get(key);
    }
    return node as TokenGroup;
}

describe("DesignMdReader", () => {
    describe("document structure", () => {
        it("parses top-level groups", async () => {
            const doc = await parse(SAMPLE);
            expect([...doc.keys()]).toContain("colors");
            expect([...doc.keys()]).toContain("typography");
            expect([...doc.keys()]).toContain("rounded");
            expect([...doc.keys()]).toContain("spacing");
            expect([...doc.keys()]).toContain("components");
        });

        it("returns Dtcg instance", async () => {
            const doc = await parse(SAMPLE);
            expect(doc).toBeInstanceOf(Dtcg);
        });

        it("stores name in root extensions", async () => {
            const doc = await parse(SAMPLE);
            expect(doc.root.extensions).toBeDefined();
            expect(doc.root.extensions!["name"]).toBe("Heritage");
        });

        it("parses nested group structure under colors", async () => {
            const doc = await parse(SAMPLE);
            const colors = doc.get("colors");
            expect(colors).toBeInstanceOf(TokenGroup);
        });
    });

    describe("colors", () => {
        it("parses hex color to ColorToken", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "colors").get("primary") as ColorToken;
            const value = token.value as ColorValue;
            expect(token).toBeInstanceOf(ColorToken);
            expect(value.colorSpace).toBe("srgb");
            expect(value.hex).toBe("#1a1c1e");
            expect(value.alpha).toBe(1);
        });

        it("parses named color", async () => {
            const doc = await parse(`---
colors:
  red: red
---`);
            const token = getGroup(doc, "colors").get("red") as ColorToken;
            const value = token.value as ColorValue;
            expect(token).toBeInstanceOf(ColorToken);
            expect(value.colorSpace).toBe("srgb");
            expect(value.hex).toBe("#ff0000");
        });

        it("parses rgb() color", async () => {
            const doc = await parse(`---
colors:
  brand: rgb(26, 28, 30)
---`);
            const token = getGroup(doc, "colors").get("brand") as ColorToken;
            const value = token.value as ColorValue;
            expect(token).toBeInstanceOf(ColorToken);
            expect(value.colorSpace).toBe("srgb");
            expect(value.alpha).toBe(1);
        });

        it("parses hsl() color", async () => {
            const doc = await parse(`---
colors:
  accent: hsl(210, 7%, 11%)
---`);
            const token = getGroup(doc, "colors").get("accent") as ColorToken;
            const value = token.value as ColorValue;
            expect(value.colorSpace).toBe("hsl");
            expect(value.components[0]).toBe(210);
        });

        it("parses oklch() color", async () => {
            const doc = await parse(`---
colors:
  vibrant: oklch(0.62 0.18 250)
---`);
            const token = getGroup(doc, "colors").get("vibrant") as ColorToken;
            const value = token.value as ColorValue;
            expect(value.colorSpace).toBe("oklch");
        });

        it("parses reference in colors", async () => {
            const doc = await parse(`---
colors:
  primary: "#1A1C1E"
  on-primary: "{colors.primary}"
---`);
            const token = getGroup(doc, "colors").get("on-primary") as TokenNode<unknown>;
            expect(token.isAlias()).toBe(true);
            expect((token.value as TokenReference).value).toBe("colors.primary");
        });
    });

    describe("typography", () => {
        it("parses typography token with full properties", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "typography").get("h1") as TypographyToken;
            expect(token).toBeInstanceOf(TypographyToken);
            const value = token.value as TypographyValue;
            expect(value.fontFamily).toBe("Public Sans");
            expect((value.fontSize as DimensionValue).value).toBe(48);
            expect((value.fontSize as DimensionValue).unit).toBe("px");
            expect(value.fontWeight).toBe(600);
            expect(value.lineHeight).toBe(1.1);
            expect((value.letterSpacing as DimensionValue).value).toBe(-0.02);
            expect((value.letterSpacing as DimensionValue).unit).toBe("em");
        });

        it("parses typography reference", async () => {
            const doc = await parse(`---
typography:
  label: "{typography.h1}"
---`);
            const token = getGroup(doc, "typography").get("label") as TypographyToken;
            expect(token.isAlias()).toBe(true);
            expect((token.value as TokenReference).value).toBe("typography.h1");
        });
        // A typography token without letterSpacing, as in the DESIGN.md spec example.
        async function typography(fontSize: string, lineHeight: string): Promise<TypographyValue> {
            const doc = await parse(`---
typography:
  body:
    fontFamily: Inter
    fontSize: ${fontSize}
    fontWeight: 400
    lineHeight: ${lineHeight}
---

## Overview
`);
            return (getGroup(doc, "typography").get("body") as TypographyToken).value as TypographyValue;
        }

        it("defaults a missing letterSpacing to 0px", async () => {
            expect((await typography("16px", "1.6")).letterSpacing).toEqual(new DimensionValue(0, "px"));
        });

        it("converts a dimension lineHeight to a multiplier of fontSize", async () => {
            expect((await typography("16px", "24px")).lineHeight).toBe(1.5);
            expect((await typography("1rem", "1.5rem")).lineHeight).toBe(1.5);
            expect((await typography("16px", "1.5em")).lineHeight).toBe(1.5);
        });

        it("rejects a dimension lineHeight that cannot be related to fontSize", async () => {
            await expect(issuesOf(`---
typography:
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 24px
---

## Overview
`)).resolves.not.toHaveLength(0);
        });
    });

    describe("rounded", () => {
        it("parses dimension tokens", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "rounded").get("sm") as DimensionToken;
            expect(token).toBeInstanceOf(DimensionToken);
            const value = token.value as DimensionValue;
            expect(value.value).toBe(4);
            expect(value.unit).toBe("px");
        });

        it("parses reference in rounded", async () => {
            const doc = await parse(`---
rounded:
  sm: 4px
  inherit: "{rounded.sm}"
---`);
            const token = getGroup(doc, "rounded").get("inherit") as DimensionToken;
            expect(token.isAlias()).toBe(true);
            expect((token.value as TokenReference).value).toBe("rounded.sm");
        });
    });

    describe("spacing", () => {
        it("parses dimension tokens", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "spacing").get("md") as DimensionToken;
            expect(token).toBeInstanceOf(DimensionToken);
            const value = token.value as DimensionValue;
            expect(value.value).toBe(16);
            expect(value.unit).toBe("px");
        });

        it("parses unitless number as NumberToken", async () => {
            const doc = await parse(`---
spacing:
  ratio: 1.5
---`);
            const token = getGroup(doc, "spacing").get("ratio") as NumberToken;
            expect(token).toBeInstanceOf(NumberToken);
            expect(token.value).toBe(1.5);
        });
    });

    describe("components", () => {
        it("parses component with property tokens", async () => {
            const doc = await parse(SAMPLE);
            const component = getGroup(doc, "components", "button-primary");
            expect(component).toBeInstanceOf(TokenGroup);
            expect([...component.keys()]).toContain("backgroundColor");
            expect([...component.keys()]).toContain("textColor");
            expect([...component.keys()]).toContain("rounded");
            expect([...component.keys()]).toContain("padding");
        });

        it("parses reference in component property as typed token", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "components", "button-primary").get("backgroundColor") as ColorToken;
            expect(token.isAlias()).toBe(true);
            expect((token.value as TokenReference).value).toBe("colors.primary");
        });

        it("parses literal color in component property", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "components", "button-primary").get("textColor") as ColorToken;
            const value = token.value as ColorValue;
            expect(value.hex).toBe("#ffffff");
        });

        it("parses literal dimension in component property", async () => {
            const doc = await parse(SAMPLE);
            const token = getGroup(doc, "components", "button-primary").get("padding") as DimensionToken;
            const value = token.value as DimensionValue;
            expect(value.value).toBe(12);
            expect(value.unit).toBe("px");
        });
    });

    describe("frontmatter", () => {
        it("reads the frontmatter keys into the document", async () => {
            const doc = await parse(SAMPLE);
            expect(doc.root.extensions!["name"]).toBe("Heritage");
            expect([...doc.keys()].length).toBeGreaterThan(0);
        });

        it("reports content without frontmatter", async () => {
            await expect(issuesOf("just some markdown")).resolves.toContain("missing-frontmatter");
        });

        it("reports prose without frontmatter", async () => {
            await expect(issuesOf("## Overview\n\nSome text.")).resolves.toContain("missing-frontmatter");
        });
    });

    describe("isDesignMd", () => {
        it("recognizes frontmatter followed by a heading", () => {
            expect(DesignMdReader.isDesignMd("---\nname: Test\n---\n\n## Overview")).toBe(true);
        });

        it("rejects content missing either frontmatter or headings", () => {
            expect(DesignMdReader.isDesignMd("## Overview")).toBe(false);
            expect(DesignMdReader.isDesignMd("---\nname: Test\n---")).toBe(false);
        });

        it("does not treat a heading inside a code fence as markdown prose", () => {
            const content = "---\nname: Test\n---\n\n```md\n# Example\n```";
            expect(DesignMdReader.isDesignMd(content)).toBe(false);
        });

        it("does not close a code fence with a line that has an info string", () => {
            const content = "---\nname: Test\n---\n\n````md\n```js\n# Example\n````";
            expect(DesignMdReader.isDesignMd(content)).toBe(false);
        });

        it("recognizes setext headings", () => {
            expect(DesignMdReader.isDesignMd("---\nname: Test\n---\n\nOverview\n========\n")).toBe(true);
            expect(DesignMdReader.isDesignMd("---\nname: Test\n---\n\nOverview\n---\n")).toBe(true);
        });
    });

    describe("error handling", () => {
        it("reports an invalid color value", async () => {
            await expect(issuesOf(`---
colors:
  bad: "not-a-valid-color-value"
---`)).resolves.not.toHaveLength(0);
        });

        it("reports an invalid dimension", async () => {
            await expect(issuesOf(`---
rounded:
  bad: "not-a-dimension"
---`)).resolves.not.toHaveLength(0);
        });

        it("reports every broken token in one read", async () => {
            const issues = await issuesOf(`---
colors:
  a: "not-a-color"
  b: "also-bad"
---`);
            expect(issues.length).toBeGreaterThanOrEqual(2);
        });
    });
});
