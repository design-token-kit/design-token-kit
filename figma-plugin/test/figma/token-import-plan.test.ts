import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { orderByDependency, toReferencePath } from "#/figma-plugin/token-import/AliasResolver";
import { mapFigmaName } from "#/figma-plugin/token-import/FigmaNameMapper";
import {
    BASE_MODE_NAME,
    buildImportPlan,
    toModeName,
    type TokenDocument,
} from "#/figma-plugin/token-import/TokenImportPlan";
import { UNSUPPORTED_TOKEN_TYPES } from "#/figma-plugin/token-import/TokenValueConverter";

const currentDir = dirname(fileURLToPath(import.meta.url));
const playgroundDir = resolve(currentDir, "../../../examples/playground");

function readPlayground(fileName: string): TokenDocument {
    return {
        fileName,
        content: JSON.parse(readFileSync(resolve(playgroundDir, fileName), "utf8")),
    };
}

function colorToken(hex: [number, number, number], description = "color"): unknown {
    return {
        $type: "color",
        $value: { colorSpace: "srgb", components: hex, alpha: 1 },
        $description: description,
    };
}

describe("FigmaNameMapper", () => {
    it("keeps the layer segment so the exporter maps the name back unchanged", () => {
        expect(mapFigmaName(["primitive", "color", "brand-500"])).toEqual({
            name: "primitive/color/brand-500",
            layer: "primitive",
        });
    });

    it("maps every supported layer", () => {
        expect(mapFigmaName(["semantic", "color", "action-primary"])?.layer).toBe("semantic");
        expect(mapFigmaName(["component", "button", "primary", "background"])?.layer).toBe("component");
    });

    it("rejects paths without a recognized layer", () => {
        expect(mapFigmaName(["palette", "color", "blue"])).toBeUndefined();
    });

    it("rejects explicit layer paths shorter than the exporter accepts", () => {
        expect(mapFigmaName(["primitive", "color"])).toBeUndefined();
    });

    it("rejects segments that would change under the exporter's slugification", () => {
        expect(mapFigmaName(["component", "modal", "zIndex"])).toBeUndefined();
        expect(mapFigmaName(["primitive", "color", "Brand 500"])).toBeUndefined();
    });
});

describe("AliasResolver", () => {
    it("reads a DTCG reference", () => {
        expect(toReferencePath("{primitive.color.brand-500}")).toBe("primitive.color.brand-500");
        expect(toReferencePath("#ffffff")).toBeUndefined();
    });

    it("orders alias targets before the entries referencing them", () => {
        const entries = [
            { key: "component.a", deps: ["semantic.a"] },
            { key: "semantic.a", deps: ["primitive.a"] },
            { key: "primitive.a", deps: [] as string[] },
        ];

        const { ordered, cycles } = orderByDependency(
            entries,
            (entry) => entry.key,
            (entry) => entry.deps,
        );

        expect(ordered.map((entry) => entry.key)).toEqual([
            "primitive.a",
            "semantic.a",
            "component.a",
        ]);
        expect(cycles).toEqual([]);
    });

    it("reports a cycle instead of throwing", () => {
        const entries = [
            { key: "a", deps: ["b"] },
            { key: "b", deps: ["a"] },
        ];

        const { ordered, cycles } = orderByDependency(
            entries,
            (entry) => entry.key,
            (entry) => entry.deps,
        );

        expect(ordered).toEqual([]);
        expect(cycles[0]?.paths).toEqual(["a", "b"]);
    });
});

describe("toModeName", () => {
    it("names the base document mode Light so it becomes the collection default", () => {
        expect(toModeName("tokens.json")).toBe(BASE_MODE_NAME);
    });

    it("inverts the exporter's file name slug", () => {
        expect(toModeName("tokens.dark.json")).toBe("Dark");
        expect(toModeName("tokens.brand-a.json")).toBe("Brand A");
    });
});

describe("buildImportPlan", () => {
    it("reports an empty input instead of failing", () => {
        const plan = buildImportPlan([]);

        expect(plan.variables).toEqual([]);
        expect(plan.warnings).toHaveLength(1);
    });

    it("creates one collection per layer", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: { color: { brand: colorToken([0, 0, 1]) } },
                    semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
                    component: {
                        button: { primary: { background: { $value: "{semantic.color.action}" } } },
                    },
                },
            },
        ]);

        expect([...plan.collections.keys()].sort()).toEqual(["Component", "Primitive", "Semantic"]);
    });

    it("resolves the type of alias tokens through the reference chain", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: { color: { brand: colorToken([0, 0, 1]) } },
                    semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
                },
            },
        ]);

        const semantic = plan.variables.find((variable) => variable.path === "semantic.color.action");

        expect(semantic?.resolvedType).toBe("COLOR");
        expect(semantic?.valuesByMode.get(BASE_MODE_NAME)).toEqual({
            kind: "alias",
            path: "primitive.color.brand",
        });
    });

    it("orders a variable after the variable it aliases", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
                    primitive: { color: { brand: colorToken([0, 0, 1]) } },
                },
            },
        ]);

        const paths = plan.variables.map((variable) => variable.path);

        expect(paths.indexOf("primitive.color.brand")).toBeLessThan(
            paths.indexOf("semantic.color.action"),
        );
    });

    it("adds a theme document as an extra mode on the same variable", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: { primitive: { color: { brand: colorToken([0, 0, 1]) } } },
            },
            {
                fileName: "tokens.dark.json",
                content: { primitive: { color: { brand: colorToken([1, 1, 1]) } } },
            },
        ]);

        expect(plan.collections.get("Primitive")).toEqual([BASE_MODE_NAME, "Dark"]);
        expect(plan.variables).toHaveLength(1);
        expect([...plan.variables[0]!.valuesByMode.keys()]).toEqual([BASE_MODE_NAME, "Dark"]);
    });

    it("marks opacity tokens with the OPACITY scope so they export as numbers", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: {
                        number: {
                            "opacity-disabled": { $type: "number", $value: 0.5 },
                            "line-height": { $type: "number", $value: 1.5 },
                        },
                    },
                },
            },
        ]);

        const opacity = plan.variables.find((variable) => variable.path.includes("opacity"));
        const lineHeight = plan.variables.find((variable) => variable.path.includes("line-height"));

        expect(opacity?.scopes).toEqual(["OPACITY"]);
        expect(lineHeight?.scopes).toEqual([]);
    });

    it("assigns dimension scopes from the token group", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: {
                        dimension: {
                            "space-100": { $type: "dimension", $value: { value: 4, unit: "px" } },
                            "radius-100": { $type: "dimension", $value: { value: 4, unit: "px" } },
                        },
                    },
                },
            },
        ]);

        expect(plan.variables.find((v) => v.path.endsWith("space-100"))?.scopes).toEqual(["GAP"]);
        expect(plan.variables.find((v) => v.path.endsWith("radius-100"))?.scopes)
            .toEqual(["CORNER_RADIUS"]);
    });

    it("skips a token whose alias target is not importable", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: { gradient: { brand: { $type: "gradient", $value: [] } } },
                    semantic: { surface: { hero: { $value: "{primitive.gradient.brand}" } } },
                },
            },
        ]);

        expect(plan.variables).toEqual([]);
        expect(plan.skipped.map((entry) => entry.path)).toContain("primitive.gradient.brand");
    });

    it("converts rem dimensions to pixels and reports the conversion", () => {
        const plan = buildImportPlan([
            {
                fileName: "tokens.json",
                content: {
                    primitive: {
                        dimension: { "space-100": { $type: "dimension", $value: { value: 1, unit: "rem" } } },
                    },
                },
            },
        ]);

        expect(plan.variables[0]?.valuesByMode.get(BASE_MODE_NAME)).toEqual({ kind: "number", value: 16 });
        expect(plan.warnings.join(" ")).toContain("rem");
    });
});

describe("buildImportPlan on the playground token set", () => {
    const plan = buildImportPlan([
        readPlayground("tokens.json"),
        readPlayground("tokens.dark.json"),
    ]);

    it("creates the three layer collections with modes only on Primitive", () => {
        expect(plan.collections.get("Primitive")).toEqual([BASE_MODE_NAME, "Dark"]);
        expect(plan.collections.get("Semantic")).toEqual([BASE_MODE_NAME]);
        expect(plan.collections.get("Component")).toEqual([BASE_MODE_NAME]);
    });

    it("imports variables, text styles and effect styles", () => {
        expect(plan.variables.length).toBeGreaterThan(0);
        expect(plan.textStyles.length).toBeGreaterThan(0);
        expect(plan.effectStyles.length).toBeGreaterThan(0);
    });

    it("keeps every planned name round-trip safe", () => {
        for (const variable of plan.variables) {
            expect(variable.name).toBe(variable.path.split(".").join("/"));
        }
    });

    it("reports every unsupported type as a skip", () => {
        const skippedTypes = new Set(plan.skipped.map((entry) => entry.type));

        for (const type of UNSUPPORTED_TOKEN_TYPES) {
            expect(skippedTypes).toContain(type);
        }
    });

    it("gives every skipped token a reason", () => {
        for (const entry of plan.skipped) {
            expect(entry.reason).not.toBe("");
        }
    });
});
