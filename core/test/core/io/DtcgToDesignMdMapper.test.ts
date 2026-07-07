import { describe, expect, it, vi, afterEach } from "vitest";
import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { DtcgToDesignMdMapper } from "#/core/io/DtcgToDesignMdMapper";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

function color(hex: string): ColorToken {
    return new ColorToken(new ColorValue("srgb", [1, 1, 1], 1, hex));
}

function dimension(value: number): DimensionToken {
    return new DimensionToken(new DimensionValue(value, "px"));
}

function typography(): TypographyToken {
    return new TypographyToken(
        new TypographyValue("Inter", new DimensionValue(16, "px"), 400, new DimensionValue(0, "px"), 1.5),
    );
}

function getGroup(doc: Dtcg, ...path: string[]): TokenGroup {
    let node: ReturnType<Dtcg["get"]> = doc.get(path[0]);
    for (const key of path.slice(1)) {
        node = (node as TokenGroup).get(key);
    }
    return node as TokenGroup;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe("DtcgToDesignMdMapper", () => {
    it("maps the base tree to DESIGN.md sections and rewrites references", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const root = new TokenGroup({ children: new Map([
            ["primitive", new TokenGroup({ children: new Map([
                ["color", new TokenGroup({ children: new Map([
                    ["white", color("#ffffff")],
                ]) })],
                ["dimension", new TokenGroup({ children: new Map([
                    ["radius-sm", dimension(4)],
                    ["space-md", dimension(16)],
                ]) })],
                ["typography", new TokenGroup({ children: new Map([
                    ["body", typography()],
                ]) })],
                ["border", new TokenGroup({ children: new Map([
                    ["subtle", color("#000000")],
                ]) })],
            ]) })],
            ["semantic", new TokenGroup({ children: new Map([
                ["color", new TokenGroup({ children: new Map([
                    ["bg", new ColorToken(new TokenReference("primitive.color.white"))],
                ]) })],
                ["shape", new TokenGroup({ children: new Map([
                    ["radius-md", new DimensionToken(new TokenReference("primitive.dimension.radius-sm"))],
                ]) })],
                ["space", new TokenGroup({ children: new Map([
                    ["gap", new DimensionToken(new TokenReference("primitive.dimension.space-md"))],
                ]) })],
                ["text", new TokenGroup({ children: new Map([
                    ["body", new TypographyToken(new TokenReference("primitive.typography.body"))],
                ]) })],
            ]) })],
            ["component", new TokenGroup({ children: new Map([
                ["button", new TokenGroup({ children: new Map([
                    ["primary", new TokenGroup({ children: new Map([
                        ["background", new ColorToken(new TokenReference("semantic.color.bg"))],
                        ["padding", new DimensionToken(new TokenReference("semantic.space.gap"))],
                        ["label", new TypographyToken(new TokenReference("semantic.text.body"))],
                        ["outline", new AliasToken(new TokenReference("primitive.border.subtle"))],
                    ]) })],
                ]) })],
            ]) })],
        ]) });

        const list = new DtcgList(new Dtcg(root), new Map([["dark", new Dtcg(new TokenGroup())]]));
        const mapped = new DtcgToDesignMdMapper().map(list);

        expect(mapped.themes.size).toBe(0);
        expect([...mapped.base.keys()]).toContain("colors");
        expect([...mapped.base.keys()]).toContain("typography");
        expect([...mapped.base.keys()]).toContain("rounded");
        expect([...mapped.base.keys()]).toContain("spacing");
        expect([...mapped.base.keys()]).toContain("components");
        expect(mapped.base.get("border")).toBeUndefined();

        const colors = getGroup(mapped.base, "colors");
        expect((colors.get("white") as ColorToken).value).toBeInstanceOf(ColorValue);
        expect((colors.get("bg") as ColorToken).value).toBeInstanceOf(TokenReference);
        expect(((colors.get("bg") as ColorToken).value as TokenReference).value).toBe("colors.white");

        const rounded = getGroup(mapped.base, "rounded");
        expect((rounded.get("radius-sm") as DimensionToken).value).toBeInstanceOf(DimensionValue);

        const components = getGroup(mapped.base, "components", "button-primary");
        expect((components.get("background") as ColorToken).value).toBeInstanceOf(TokenReference);
        expect(((components.get("background") as ColorToken).value as TokenReference).value).toBe("colors.bg");
        expect(((components.get("padding") as DimensionToken).value as TokenReference).value).toBe("spacing.gap");
        expect(((components.get("label") as TypographyToken).value as TokenReference).value).toBe("typography.body");
        expect(components.get("outline")).toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });

    it("removes references to unmapped unsupported tokens", () => {
        const root = new TokenGroup({ children: new Map([
            ["primitive", new TokenGroup({ children: new Map([
                ["border", new TokenGroup({ children: new Map([
                    ["subtle", color("#000000")],
                ]) })],
            ]) })],
            ["component", new TokenGroup({ children: new Map([
                ["alert", new TokenGroup({ children: new Map([
                    ["border", new ColorToken(new TokenReference("primitive.border.subtle"))],
                ]) })],
            ]) })],
        ]) });

        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const mapped = new DtcgToDesignMdMapper().map(new DtcgList(new Dtcg(root)));

        const alert = getGroup(mapped.base, "components", "alert");
        expect(alert).toBeInstanceOf(TokenGroup);
        expect(alert.get("border")).toBeUndefined();
        expect(warn).toHaveBeenCalled();
    });
});
