import { describe, it, expect } from "vitest";
import { DesignMdReader } from "#/core/io/DesignMdReader";
import { DesignMdWriter } from "#/core/io/DesignMdWriter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
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

function write(doc: Dtcg): string {
    return new DesignMdWriter().write(doc);
}

function parse(md: string): Dtcg {
    return new DesignMdReader().parse(md);
}

describe("DesignMdWriter", () => {
    describe("round-trip", () => {
        it("produces output readable by DesignMdReader", () => {
            const doc = parse(SAMPLE);
            const written = write(doc);
            expect(() => parse(written)).not.toThrow();
        });

        it("preserves top-level group keys", () => {
            const doc = parse(write(parse(SAMPLE)));
            expect([...doc.keys()]).toContain("colors");
            expect([...doc.keys()]).toContain("typography");
            expect([...doc.keys()]).toContain("rounded");
            expect([...doc.keys()]).toContain("spacing");
            expect([...doc.keys()]).toContain("components");
        });

        it("preserves color values", () => {
            const doc = parse(SAMPLE);
            const written = write(doc);
            const roundTripped = parse(written);
            const token = (roundTripped.get("colors") as TokenGroup).get("primary") as ColorToken;
            expect((token.value as ColorValue).hex).toBe("#1a1c1e");
        });

        it("preserves typography values", () => {
            const doc = parse(SAMPLE);
            const written = write(doc);
            const roundTripped = parse(written);
            const token = (roundTripped.get("typography") as TokenGroup).get("h1") as TypographyToken;
            const value = token.value as TypographyValue;
            expect(value.fontFamily).toBe("Public Sans");
            expect((value.fontSize as DimensionValue).value).toBe(48);
            expect(value.fontWeight).toBe(600);
            expect(value.lineHeight).toBe(1.1);
        });

        it("preserves component references", () => {
            const doc = parse(SAMPLE);
            const written = write(doc);
            const roundTripped = parse(written);
            const component = (roundTripped.get("components") as TokenGroup).get("button-primary") as TokenGroup;
            const bg = component.get("backgroundColor") as ColorToken;
            expect((bg.value as TokenReference).value).toBe("colors.primary");
        });

        it("preserves name in frontmatter", () => {
            const doc = parse(write(parse(SAMPLE)));
            expect(doc.root.extensions!["name"]).toBe("Heritage");
        });
    });

    describe("output format", () => {
        it("wraps YAML in --- delimiters", () => {
            const doc = parse(SAMPLE);
            const result = write(doc);
            expect(result.startsWith("---\n")).toBe(true);
            expect(result).toContain("\n---\n");
        });

        it("includes empty section headers", () => {
            const doc = parse(SAMPLE);
            const result = write(doc);
            expect(result).toContain("## Overview");
            expect(result).toContain("## Colors");
            expect(result).toContain("## Typography");
            expect(result).toContain("## Layout");
            expect(result).toContain("## Components");
            expect(result).toContain("## Do's and Don'ts");
        });

        it("sections appear after closing ---", () => {
            const doc = parse(SAMPLE);
            const result = write(doc);
            const afterClose = result.split("---\n")[2];
            expect(afterClose?.startsWith("\n## Overview")).toBe(true);
        });
    });

    describe("writes tokens", () => {
        it("writes color token as hex string", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"));
            const colors = new TokenGroup({ children: new Map([["red", token]]) });
            const root = new TokenGroup({ children: new Map([["colors", colors]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('red: "#ff0000"');
        });

        it("writes color token with alpha as hex", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0], 0.5, "#ff0000"));
            const colors = new TokenGroup({ children: new Map([["semi", token]]) });
            const root = new TokenGroup({ children: new Map([["colors", colors]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('semi: "#ff000080"');
        });

        it("writes dimension token", () => {
            const token = new DimensionToken(new DimensionValue(8, "px"));
            const dims = new TokenGroup({ children: new Map([["sm", token]]) });
            const root = new TokenGroup({ children: new Map([["rounded", dims]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("sm: 8px");
        });

        it("writes number token", () => {
            const token = new NumberToken(1.5);
            const nums = new TokenGroup({ children: new Map([["ratio", token]]) });
            const root = new TokenGroup({ children: new Map([["spacing", nums]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("ratio: 1.5");
        });

        it("writes typography token", () => {
            const typo = new TypographyValue("Inter", new DimensionValue(16, "px"), 400, new DimensionValue(0, "px"), 1.5);
            const token = new TypographyToken(typo);
            const typos = new TokenGroup({ children: new Map([["body", token]]) });
            const root = new TokenGroup({ children: new Map([["typography", typos]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("fontFamily: Inter");
            expect(result).toContain("fontSize: 16px");
            expect(result).toContain("fontWeight: 400");
            expect(result).toContain("letterSpacing: 0px");
            expect(result).toContain("lineHeight: 1.5");
        });
    });

    describe("writes references", () => {
        it("writes token reference as quoted curly-brace string", () => {
            const token = new ColorToken(new TokenReference("colors.primary"));
            const colors = new TokenGroup({ children: new Map([["bg", token]]) });
            const root = new TokenGroup({ children: new Map([["colors", colors]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('bg: "{colors.primary}"');
        });

        it("writes component property reference", () => {
            const token = new ColorToken(new TokenReference("colors.tertiary"));
            const props = new TokenGroup({ children: new Map([["backgroundColor", token]]) });
            const components = new TokenGroup({ children: new Map([["btn", props]]) });
            const root = new TokenGroup({ children: new Map([["components", components]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('backgroundColor: "{colors.tertiary}"');
        });
    });

    describe("writes non-sRGB colors", () => {
        it("writes hsl color as CSS function", () => {
            const token = new ColorToken(new ColorValue("hsl", [210, 7, 11], 1));
            const colors = new TokenGroup({ children: new Map([["accent", token]]) });
            const root = new TokenGroup({ children: new Map([["colors", colors]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('accent: "hsl(210 7 11)"');
        });

        it("writes oklch color as CSS function", () => {
            const token = new ColorToken(new ColorValue("oklch", [0.62, 0.18, 250], 1));
            const colors = new TokenGroup({ children: new Map([["vibrant", token]]) });
            const root = new TokenGroup({ children: new Map([["colors", colors]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('vibrant: "oklch(0.62 0.18 250)"');
        });
    });
});
