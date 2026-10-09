import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
import { TokenFormat } from "#/core/formats/TokenFormat";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";

const tempDirs: string[] = [];

function tempFile(name: string, content: string): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "design-token-kit-loader-"));
    tempDirs.push(dir);
    const file = path.join(dir, name);
    writeFileSync(file, content, "utf8");
    return file;
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

const DTCG_BASE = `{
  "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
  "primitive": {
    "color": {
      "$type": "color",
      "white": { "$value": { "colorSpace": "srgb", "components": [1, 1, 1], "hex": "#ffffff" } }
    }
  },
  "semantic": {
    "color": {
      "$type": "color",
      "bg": { "$value": "{primitive.color.white}" }
    }
  }
}`;

const HRDT_THEME = `primitive:
  color:
    white: "#ffffff"
semantic:
  color:
    bg: "{primitive.color.white}"
`;

const DESIGN_MD_THEME = `---
name: Night
colors:
  background: "#000000"
---

## Overview
`;

describe("DtcgListLoader", () => {
    it("loads mixed formats into a DtcgList", async () => {
        const base = tempFile("base.json", DTCG_BASE);
        const dark = tempFile("dark.yaml", HRDT_THEME);
        const night = tempFile("night.design.md", DESIGN_MD_THEME);

        const list = await new DtcgListLoader().load([base, dark, night]);

        expect(list).toBeInstanceOf(DtcgList);
        expect(list.base).toBeInstanceOf(Dtcg);
        expect(list.base.get("primitive")).toBeInstanceOf(TokenGroup);
        expect(list.themes.size).toBe(2);
        expect([...list.themes.keys()]).toEqual(["dark", "night"]);
        expect(list.themes.get("dark")).toBeInstanceOf(Dtcg);
        expect(list.themes.get("night")).toBeInstanceOf(Dtcg);
    });

    it("honors a forced format for all sources", async () => {
        const base = tempFile("base.yaml", HRDT_THEME);
        const dark = tempFile("dark.yaml", HRDT_THEME);

        const list = await new DtcgListLoader().load([base, dark], TokenFormat.HRDT);

        expect(list.base).toBeInstanceOf(Dtcg);
        expect([...list.themes.keys()]).toEqual(["dark"]);
        expect(list.base.get("primitive")).toBeInstanceOf(TokenGroup);
    });

    it("reads the theme past a format segment in the file name", async () => {
        const base = tempFile("showcase.dtcg.json", DTCG_BASE);
        const dark = tempFile("showcase.dark.dtcg.json", DTCG_BASE);

        const list = await new DtcgListLoader().load([base, dark]);

        expect([...list.themes.keys()]).toEqual(["dark"]);
    });

    // A base document listed after the first carries no theme, so it is named
    // by its role and several of them stay apart.
    it("names a themeless source by its role", async () => {
        const base = tempFile("tokens.json", DTCG_BASE);
        const other = tempFile("overrides.json", DTCG_BASE);

        const list = await new DtcgListLoader().load([base, other]);

        expect([...list.themes.keys()]).toEqual(["overrides"]);
    });

    it("throws TokenSyntaxError for invalid sources", async () => {
        const bad = tempFile("bad.yaml", `primitive:\n  color:\n    bad: \"not-a-color\"\n`);

        try {
            await new DtcgListLoader().load([bad]);
            throw new Error("Expected load() to fail");
        }
        catch (error) {
            expect(error).toBeInstanceOf(TokenSyntaxError);

            if (error instanceof TokenSyntaxError) {
                expect(error.issues.length).toBeGreaterThan(0);
                expect(error.issues[0].sourcePath).toBe(bad);
                expect(error.formatIssues()).toContain("Expected hex color");
                expect(error.formatIssues()).toContain("bad.yaml");
            }
        }
    });
});
