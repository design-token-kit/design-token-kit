import { describe, expect, it } from "vitest";

import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import { FigmaScriptTokenConverter } from "#/core/platforms/figma-script/FigmaScriptTokenConverter";

function convert(json: object): string {
    const doc = new DtcgJsonReader().parse(JSON.stringify(json));
    return new FigmaScriptTokenConverter().convertDocument(doc);
}

function convertList(base: object, themes: Record<string, object> = {}): string {
    const reader = new DtcgJsonReader();
    const baseDoc = reader.parse(JSON.stringify(base));
    const themeMap = new Map(
        Object.entries(themes).map(([name, doc]) => [name, reader.parse(JSON.stringify(doc))]),
    );

    return new FigmaScriptTokenConverter().convertList(new DtcgList(baseDoc, themeMap));
}

/** Reads one of the data literals the generated script declares. */
function readData(script: string, name: string): unknown {
    const match = new RegExp(`const ${name} = ([\\s\\S]*?);\\n`).exec(script);
    expect(match, `${name} must be declared`).not.toBeNull();
    return JSON.parse(match![1]!);
}

function color(components: [number, number, number]): object {
    return { $type: "color", $value: { colorSpace: "srgb", components, alpha: 1 } };
}

const LAYERED = {
    primitive: { color: { brand: color([0, 0, 1]) } },
    semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
    component: { button: { primary: { background: { $value: "{semantic.color.action}" } } } },
};

describe("FigmaScriptTokenConverter", () => {
    it("emits a runnable script", () => {
        const script = convert(LAYERED);

        expect(script).toContain("async function applyTokens()");
        expect(script).toContain("await applyTokens();");
    });

    it("creates one collection per token layer", () => {
        const collections = readData(convert(LAYERED), "COLLECTIONS") as Array<{ name: string }>;

        expect(collections.map((entry) => entry.name)).toEqual(["Primitive", "Semantic", "Component"]);
    });

    it("keeps a reference as an alias instead of copying the value", () => {
        const variables = readData(convert(LAYERED), "VARIABLES") as Array<{
            path: string;
            values: Record<string, { alias?: string }>;
        }>;

        const semantic = variables.find((entry) => entry.path === "semantic.color.action");

        expect(semantic?.values["Light"]).toEqual({ alias: "primitive.color.brand" });
    });

    it("orders an alias target before the variable pointing at it", () => {
        const variables = readData(convert(LAYERED), "VARIABLES") as Array<{ path: string }>;
        const paths = variables.map((entry) => entry.path);

        expect(paths.indexOf("primitive.color.brand")).toBeLessThan(paths.indexOf("semantic.color.action"));
        expect(paths.indexOf("semantic.color.action"))
            .toBeLessThan(paths.indexOf("component.button.primary.background"));
    });

    it("gives an alias the type of its target", () => {
        const variables = readData(convert(LAYERED), "VARIABLES") as Array<{
            path: string;
            resolvedType: string;
        }>;

        expect(variables.find((entry) => entry.path === "semantic.color.action")?.resolvedType)
            .toBe("COLOR");
    });

    it("turns each theme into a mode of the same collection", () => {
        const script = convertList(
            { primitive: { color: { brand: color([0, 0, 1]) } } },
            { dark: { primitive: { color: { brand: color([1, 1, 1]) } } } },
        );

        const collections = readData(script, "COLLECTIONS") as Array<{ name: string; modes: string[] }>;
        const variables = readData(script, "VARIABLES") as Array<{ values: Record<string, unknown> }>;

        expect(collections[0]?.modes).toEqual(["Light", "Dark"]);
        expect(Object.keys(variables[0]!.values)).toEqual(["Light", "Dark"]);
    });

    it("names a multi-word theme as a readable mode", () => {
        const script = convertList(
            { primitive: { color: { brand: color([0, 0, 1]) } } },
            { "brand-a": { primitive: { color: { brand: color([1, 0, 0]) } } } },
        );

        const collections = readData(script, "COLLECTIONS") as Array<{ modes: string[] }>;

        expect(collections[0]?.modes).toEqual(["Light", "Brand A"]);
    });

    it("marks an opacity token with the scope the export path reads back", () => {
        const script = convert({
            primitive: {
                number: {
                    "opacity-disabled": { $type: "number", $value: 0.5 },
                    "line-height": { $type: "number", $value: 1.5 },
                },
            },
        });

        const variables = readData(script, "VARIABLES") as Array<{ path: string; scopes: string[] }>;

        expect(variables.find((entry) => entry.path.includes("opacity"))?.scopes).toEqual(["OPACITY"]);
        expect(variables.find((entry) => entry.path.includes("line-height"))?.scopes).toEqual([]);
    });

    it("assigns dimension scopes from the token group", () => {
        const script = convert({
            primitive: {
                dimension: {
                    "space-100": { $type: "dimension", $value: { value: 4, unit: "px" } },
                    "radius-100": { $type: "dimension", $value: { value: 4, unit: "px" } },
                },
            },
        });

        const variables = readData(script, "VARIABLES") as Array<{ path: string; scopes: string[] }>;

        expect(variables.find((entry) => entry.path.endsWith("space-100"))?.scopes).toEqual(["GAP"]);
        expect(variables.find((entry) => entry.path.endsWith("radius-100"))?.scopes)
            .toEqual(["CORNER_RADIUS"]);
    });

    it("creates a text style from a typography token", () => {
        const script = convert({
            primitive: {
                typography: {
                    body: {
                        $type: "typography",
                        $value: {
                            fontFamily: ["Inter", "sans-serif"],
                            fontSize: { value: 16, unit: "px" },
                            fontWeight: 600,
                            letterSpacing: { value: 0, unit: "px" },
                            lineHeight: 1.5,
                        },
                    },
                },
            },
        });

        const styles = readData(script, "TEXT_STYLES") as Array<Record<string, unknown>>;

        expect(styles[0]).toMatchObject({
            name: "primitive/typography/body",
            fontFamily: "Inter",
            fontStyle: "SemiBold",
            fontSize: 16,
            lineHeight: 1.5,
        });
    });

    it("creates an effect style from a shadow token", () => {
        const script = convert({
            primitive: {
                shadow: {
                    surface: {
                        $type: "shadow",
                        $value: {
                            color: { colorSpace: "srgb", components: [0, 0, 0], alpha: 0.5 },
                            offsetX: { value: 0, unit: "px" },
                            offsetY: { value: 4, unit: "px" },
                            blur: { value: 8, unit: "px" },
                            spread: { value: 0, unit: "px" },
                        },
                    },
                },
            },
        });

        const styles = readData(script, "EFFECT_STYLES") as Array<{ effects: Array<{ type: string }> }>;

        expect(styles[0]?.effects[0]).toMatchObject({ type: "DROP_SHADOW", radius: 8 });
    });

    it("reports every type Figma cannot represent", () => {
        const script = convert({
            primitive: {
                fontFamily: { body: { $type: "fontFamily", $value: ["Inter"] } },
                fontWeight: { bold: { $type: "fontWeight", $value: 700 } },
                duration: { fast: { $type: "duration", $value: { value: 100, unit: "ms" } } },
                cubicBezier: { standard: { $type: "cubicBezier", $value: [0, 0, 1, 1] } },
                strokeStyle: { solid: { $type: "strokeStyle", $value: "solid" } },
                gradient: {
                    brand: {
                        $type: "gradient",
                        $value: [
                            { color: { colorSpace: "srgb", components: [0, 0, 1], alpha: 1 }, position: 0 },
                            { color: { colorSpace: "srgb", components: [1, 0, 0], alpha: 1 }, position: 1 },
                        ],
                    },
                },
            },
        });

        const skipped = readData(script, "SKIPPED") as Array<{ type: string; reason: string }>;
        const types = new Set(skipped.map((entry) => entry.type));

        expect(types).toEqual(new Set([
            "fontFamily", "fontWeight", "duration", "cubicBezier", "strokeStyle", "gradient",
        ]));
        for (const entry of skipped) {
            expect(entry.reason).not.toBe("");
        }
    });

    it("blames the type, not the name, when a correct path carries an unsupported type", () => {
        const script = convert({
            primitive: { fontFamily: { body: { $type: "fontFamily", $value: ["Inter"] } } },
        });

        const skipped = readData(script, "SKIPPED") as Array<{ type: string }>;

        expect(skipped[0]?.type).toBe("fontFamily");
    });

    it("skips a token whose alias target is not importable", () => {
        const script = convert({
            primitive: { gradient: { brand: { $type: "gradient", $value: [] } } },
            semantic: { surface: { hero: { $value: "{primitive.gradient.brand}" } } },
        });

        const variables = readData(script, "VARIABLES") as unknown[];
        const skipped = readData(script, "SKIPPED") as Array<{ path: string }>;

        expect(variables).toEqual([]);
        expect(skipped.map((entry) => entry.path)).toContain("semantic.surface.hero");
    });

    it("reports a reference cycle rather than looping", () => {
        const script = convert({
            semantic: {
                color: {
                    first: { $value: "{semantic.color.second}" },
                    second: { $value: "{semantic.color.first}" },
                },
            },
        });

        const skipped = readData(script, "SKIPPED") as Array<{ type: string; reason: string }>;

        expect(skipped.some((entry) => entry.reason.includes("cycle"))).toBe(true);
    });

    it("skips a path that cannot round-trip through the export path", () => {
        const script = convert({
            primitive: { color: color([0, 0, 1]) },
        });

        const skipped = readData(script, "SKIPPED") as Array<{ type: string }>;

        expect(skipped[0]?.type).toBe("naming");
    });

    it("carries token descriptions into the script", () => {
        const script = convert({
            primitive: {
                color: {
                    brand: { ...color([0, 0, 1]), $description: "Primary brand colour." },
                },
            },
        });

        const variables = readData(script, "VARIABLES") as Array<{ description: string }>;

        expect(variables[0]?.description).toBe("Primary brand colour.");
    });

    it("lists what Figma cannot express in the header", () => {
        const script = convert({
            primitive: { duration: { fast: { $type: "duration", $value: { value: 100, unit: "ms" } } } },
        });

        expect(script).toContain("Not representable in Figma");
        expect(script).toContain("Figma has no duration variable type");
    });
});
