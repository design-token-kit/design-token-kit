import { describe, expect, it } from "vitest";
import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import { DtcgList } from "#/core/model/DtcgList";
import type { Dtcg } from "#/core/model/Dtcg";

const WHITE = { colorSpace: "srgb", components: [1, 1, 1], alpha: 1, hex: "#ffffff" };
const SLATE = { colorSpace: "srgb", components: [0, 0, 0], alpha: 1, hex: "#000000" };

const base = {
    primitive: {
        color: {
            white: { $type: "color", $value: WHITE, $description: "Pure white" },
            slate: { $type: "color", $value: SLATE },
        },
    },
    semantic: { surface: { $type: "color", $value: "{primitive.color.white}" } },
};

const dark = {
    semantic: { surface: { $type: "color", $value: "{primitive.color.slate}" } },
    component: { card: { bg: { $type: "color", $value: "{semantic.surface}" } } },
};

async function read(json: object, source: string): Promise<Dtcg> {
    const result = await DtcgReader.noSchema().read(JSON.stringify(json), source);
    if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join("\n"));
    return result.documents[0];
}

async function readList(): Promise<DtcgList> {
    return new DtcgList(await read(base, "base.json"), new Map([["dark", await read(dark, "dark.json")]]));
}

describe("CssTokenConverter.convertListWithMap", () => {
    const converter = new CssTokenConverter();

    it("produces the same CSS as convertList", async () => {
        const list: DtcgList = await readList();
        const { css } = converter.convertListWithMap(list);
        expect(css).toBe(converter.convertList(list));
    });

    it("maps every emitted custom property to its token", async () => {
        const { map } = converter.convertListWithMap(await readList());
        const white = map.findByCustomProperty("--primitive-color-white");
        expect(white?.path.toString()).toBe("primitive.color.white");
        expect(white?.type).toBe("color");
        expect(white?.description).toBe("Pure white");
        expect(white?.source).toBe("base.json");
        expect(map.findByCustomProperty("--semantic-surface")?.path.toString()).toBe("semantic.surface");
    });

    it("keeps the base entry for a theme override", async () => {
        const { map } = converter.convertListWithMap(await readList());
        expect(map.findByCustomProperty("--semantic-surface")?.source).toBe("base.json");
    });

    it("adds a theme-only token with the theme source", async () => {
        const { map } = converter.convertListWithMap(await readList());
        expect(map.findByCustomProperty("--component-card-bg")?.source).toBe("dark.json");
    });

    it("lists entries in the order conversion emitted them", async () => {
        const { map } = converter.convertListWithMap(await readList());
        expect(map.entries().map((entry) => entry.customProperty)).toEqual([
            "--primitive-color-white",
            "--primitive-color-slate",
            "--semantic-surface",
            "--component-card-bg",
        ]);
    });

    it("maps a custom property produced by two paths to the last one, as the cascade does", async () => {
        const doc: Dtcg = await read({
            a: { "b-c": { $type: "color", $value: WHITE } },
            "a-b": { c: { $type: "color", $value: SLATE } },
        }, "clash.json");
        const { map } = converter.convertListWithMap(new DtcgList(doc, new Map()));
        expect(map.findByCustomProperty("--a-b-c")?.path.toString()).toBe("a-b.c");
        expect(map.entries()).toHaveLength(1);
    });

    it("takes the source of the first theme for a token only themes define", async () => {
        const light = { component: { badge: { $type: "color", $value: WHITE } } };
        const contrast = { component: { badge: { $type: "color", $value: SLATE } } };
        const list = new DtcgList(await read(base, "base.json"), new Map([
            ["light", await read(light, "light.json")],
            ["contrast", await read(contrast, "contrast.json")],
        ]));
        const { map } = converter.convertListWithMap(list);
        expect(map.findByCustomProperty("--component-badge")?.source).toBe("light.json");
    });

    it("maps a group root token to the group path", async () => {
        const doc: Dtcg = await read({
            accent: { $root: { $type: "color", $value: WHITE }, hover: { $type: "color", $value: SLATE } },
        }, "root.json");
        const { map } = converter.convertListWithMap(new DtcgList(doc, new Map()));
        expect(map.findByCustomProperty("--accent")?.path.toString()).toBe("accent");
        expect(map.findByCustomProperty("--accent-hover")?.path.toString()).toBe("accent.hover");
    });

    it("gives empty CSS and an empty map when the base has no tokens", async () => {
        const doc: Dtcg = await read({}, "empty.json");
        const { css, map } = converter.convertListWithMap(new DtcgList(doc, new Map()));
        expect(css).toBe("");
        expect(map.entries()).toHaveLength(0);
    });
});
