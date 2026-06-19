import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import { TokenStatsCalculator } from "#/core/stats/TokenStatsCalculator";
import { TokenStatsBuilder } from "#/core/stats/TokenStatsBuilder";

function createStatsBuilder(): TokenStatsBuilder {
    return new TokenStatsBuilder(
        new DtcgListLoader(),
        new TokenStatsCalculator(),
    );
}

function createTempTokenFile(name: string, content: string): { dir: string; file: string } {
    const dir = resolve(tmpdir(), `dtokens-core-stats-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, name);
    writeFileSync(file, content, "utf8");
    return { dir, file };
}

describe("TokenStatsBuilder", () => {
    it("counts literal and alias tokens in HRDT YAML", async () => {
        const temp = createTempTokenFile("tokens.yaml", `
primitive:
  color:
    white: "#ffffff"
    brand-500: "#2549f6"

semantic:
  color:
    background-page: "{primitive.color.white}"
    action-primary: "{primitive.color.brand-500}"

component:
  button:
    primary:
      background: "{semantic.color.action-primary}"
`);
        try {
            const stats = await createStatsBuilder().collect([temp.file]);
            expect(stats[0]?.label).toBe("Total tokens");
            expect(stats[0]?.value).toBe(5);
            expect(stats[1]).toMatchObject({
                label: "Referenced tokens",
                value: 3,
                percentage: 60,
            });
            expect(stats[2]).toMatchObject({
                label: "Direct values",
                value: 2,
                percentage: 40,
            });
            expect(stats[0]?.breakdowns?.[0]).toEqual({
                label: "Tokens by namespace",
                items: [
                    { label: "primitive", value: 2, percentage: 40 },
                    { label: "semantic", value: 2, percentage: 40 },
                    { label: "component", value: 1, percentage: 20 },
                ],
            });
            expect(stats[0]?.breakdowns?.[1]?.label).toBe("Primitive tokens by type");
        } finally {
            rmSync(temp.dir, { recursive: true, force: true });
        }
    });

    it("counts primitive tokens by resolved type", async () => {
        const stats = await createStatsBuilder().collect([JSON.stringify({
            "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
            "primitive": {
                "color": {
                    "$type": "color",
                    "white": {
                        "$value": {
                            "colorSpace": "srgb",
                            "components": [1, 1, 1],
                            "hex": "#ffffff",
                        },
                    },
                },
                "space": {
                    "$type": "dimension",
                    "small": {
                        "$value": {
                            "value": 8,
                            "unit": "px",
                        },
                    },
                },
            },
            "semantic": {
                "page": {
                    "background": {
                        "$value": "{primitive.color.white}",
                    },
                },
            },
            "misc": {
                "raw": {
                    "$value": "{primitive.color.white}",
                },
            },
        })]);

        expect(stats[0]?.breakdowns?.[1]).toEqual({
            label: "Primitive tokens by type",
            items: [
                { label: "color", value: 1, percentage: 50 },
                { label: "dimension", value: 1, percentage: 50 },
            ],
        });
        expect(stats[1]?.value).toBe(2);
        expect(stats[2]?.value).toBe(2);
    });

    it("uses tokens by type for flat documents without layers", async () => {
        const stats = await createStatsBuilder().collect([JSON.stringify({
            "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
            "color-white": {
                "$type": "color",
                "$value": {
                    "colorSpace": "srgb",
                    "components": [1, 1, 1],
                    "alpha": 1,
                    "hex": "#ffffff",
                },
            },
            "color-text-primary": {
                "$type": "color",
                "$value": "{color-white}",
            },
            "space-md": {
                "$type": "dimension",
                "$value": {
                    "value": 16,
                    "unit": "px",
                },
            },
            "button-padding": {
                "$type": "dimension",
                "$value": "{space-md}",
            },
        })]);

        expect(stats[0]?.breakdowns?.[0]).toEqual({
            label: "Tokens by type",
            items: [
                { label: "color", value: 2, percentage: 50 },
                { label: "dimension", value: 2, percentage: 50 },
            ],
        });
        expect(stats[0]?.breakdowns?.find((breakdown) => breakdown.label === "Tokens by namespace")).toBeUndefined();
        expect(stats[0]?.breakdowns?.find((breakdown) => breakdown.label === "Primitive tokens by type")).toBeUndefined();
    });

    it("returns per-theme breakdown when theme sources are provided", async () => {
        const base = createTempTokenFile("tokens.yaml", `
primitive:
  color:
    white: "#ffffff"
semantic:
  color:
    text-default: "{primitive.color.white}"
`);
        const theme = createTempTokenFile("tokens.dark.yaml", `
semantic:
  color:
    text-default: "{primitive.color.white}"
    text-inverse: "{primitive.color.white}"
`);
        try {
            const stats = await createStatsBuilder().collect([base.file, theme.file]);
            expect(stats[0]?.value).toBe(2);
            expect(stats[0]?.breakdowns?.[0]).toEqual({
                label: "Tokens by namespace",
                items: [
                    {
                        label: "primitive",
                        value: 1,
                        percentage: 50,
                    },
                    {
                        label: "semantic",
                        value: 1,
                        percentage: 50,
                    },
                ],
            });
            expect(stats[0]?.breakdowns?.[1]?.label).toBe("Primitive tokens by type");
            expect(stats[0]?.breakdowns?.[2]).toEqual({
                label: "Themes 2",
                items: [
                    { label: "base" },
                    { label: "dark" },
                ],
            });
            expect(stats[0]?.breakdowns?.[3]).toEqual({
                label: "Tokens by theme",
                items: [
                    {
                        label: "dark",
                        value: 2,
                        percentage: 100,
                    },
                ],
            });
        } finally {
            rmSync(base.dir, { recursive: true, force: true });
            rmSync(theme.dir, { recursive: true, force: true });
        }
    });

    it("renders text output", async () => {
        const temp = createTempTokenFile("tokens.yaml", `
primitive:
  color:
    white: "#ffffff"
`);
        try {
            const output = await createStatsBuilder().stats([temp.file]);
            expect(output).toBe(`Token Overview

Total tokens:      1
Referenced tokens: 0 - 0.0%
Direct values:     1 - 100.0%

Tokens by namespace:
  primitive .... 1 - 100.0%

Primitive tokens by type:
  color .... 1 - 100.0%

Themes 1:
  base
`);
        } finally {
            rmSync(temp.dir, { recursive: true, force: true });
        }
    });
});
