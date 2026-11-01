import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FigmaUsageSampler } from "#/figma-plugin/design-audit/FigmaUsageSampler";
import { frame, gradient, group, page, rect, solid, text } from "./figmaNodes";

const BOX = { x: 0, y: 0, width: 100, height: 100 };

const VARIABLES: Record<string, { name: string }> = {
    "var:accent": { name: "Semantic/Accent" },
    "var:blue": { name: "primitive/blue/500" },
    "var:space": { name: "spacing/4" },
};
const STYLES: Record<string, { name: string }> = {
    "style:body": { name: "Body/M" },
    "style:brand": { name: "Brand" },
};

function alias(id: string): VariableAlias {
    return { type: "VARIABLE_ALIAS", id };
}

function boundSolid(hex: string, variableId: string): Paint {
    return { ...solid(hex), boundVariables: { color: alias(variableId) } } as SolidPaint;
}

async function sample(root: PageNode, includePage = false) {
    const sampled = await new FigmaUsageSampler().sample([root], includePage);
    return sampled.map(({ sample: entry, node }) => ({
        node: node.name,
        property: entry.part === undefined ? entry.property : `${entry.property} ${entry.part}`,
        value: entry.value.type === "color" ? "color" : entry.value.px,
        binding: entry.binding === undefined ? undefined : `${entry.binding.kind} ${entry.binding.name} ${entry.binding.layer ?? "-"}`,
    }));
}

describe("FigmaUsageSampler", () => {
    beforeEach(() => {
        vi.stubGlobal("figma", {
            variables: { getVariableByIdAsync: vi.fn(async (id: string) => VARIABLES[id] ?? null) },
            getStyleByIdAsync: vi.fn(async (id: string) => STYLES[id] ?? null),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("reads fills and strokes with their variable or style", async () => {
        const root = page("Page", [
            rect("Hard-coded", BOX, [solid("#2563eb")]),
            rect("Bound", BOX, [boundSolid("#2563eb", "var:blue")], { strokes: [boundSolid("#2563eb", "var:accent")], strokeWeight: 1 }),
            rect("Styled", BOX, [solid("#2563eb")], { fillStyleId: "style:brand" }),
        ]);

        expect(await sample(root)).toEqual([
            { node: "Hard-coded", property: "fill", value: "color", binding: undefined },
            { node: "Bound", property: "fill", value: "color", binding: "variable primitive/blue/500 primitive" },
            { node: "Bound", property: "stroke", value: "color", binding: "variable Semantic/Accent semantic" },
            { node: "Styled", property: "fill", value: "color", binding: "style Brand -" },
        ]);
    });

    it("skips gradients, hidden paints, strokes of zero width and mixed text fills", async () => {
        const root = page("Page", [
            rect("Gradient", BOX, [gradient(), { ...solid("#ffffff"), visible: false } as Paint]),
            rect("No stroke", BOX, [], { strokes: [solid("#000000")], strokeWeight: 0 }),
            text("Mixed", BOX, { fills: Symbol("mixed") }),
        ]);

        expect((await sample(root)).filter((entry) => entry.property !== "font-size")).toEqual([]);
    });

    it("reads radii, gaps and paddings of auto layout", async () => {
        const root = page("Page", [
            {
                ...frame("Stack", BOX, []),
                cornerRadius: 8,
                topLeftRadius: 8,
                layoutMode: "VERTICAL",
                primaryAxisAlignItems: "MIN",
                itemSpacing: 12,
                layoutWrap: "NO_WRAP",
                paddingTop: 16,
                paddingRight: 0,
                paddingBottom: 16,
                paddingLeft: 0,
                boundVariables: { itemSpacing: alias("var:space") },
            },
            { ...rect("Tab", BOX, []), cornerRadius: Symbol("mixed"), topLeftRadius: 4, topRightRadius: 4, bottomRightRadius: 0, bottomLeftRadius: 0 },
            { ...frame("Spread", BOX, []), layoutMode: "HORIZONTAL", primaryAxisAlignItems: "SPACE_BETWEEN", itemSpacing: 24,
                layoutWrap: "NO_WRAP", paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
        ]);

        expect(await sample(root)).toEqual([
            { node: "Stack", property: "corner-radius", value: 8, binding: undefined },
            { node: "Stack", property: "gap", value: 12, binding: "variable spacing/4 -" },
            { node: "Stack", property: "padding top", value: 16, binding: undefined },
            { node: "Stack", property: "padding bottom", value: 16, binding: undefined },
            { node: "Tab", property: "corner-radius top left", value: 4, binding: undefined },
            { node: "Tab", property: "corner-radius top right", value: 4, binding: undefined },
        ]);
    });

    it("reads the font size of text, bound to a text style or a variable", async () => {
        const root = page("Page", [
            { ...text("Styled", BOX, { fills: [] }), textStyleId: "style:body" },
            { ...text("Bound", BOX, { fills: [], fontSize: 14 }), textStyleId: "", boundVariables: { fontSize: [alias("var:space")] } },
            { ...text("Plain", BOX, { fills: [] }), textStyleId: "" },
            { ...text("Mixed", BOX, { fills: [], fontSize: Symbol("mixed") }), textStyleId: "" },
        ]);

        expect(await sample(root)).toEqual([
            { node: "Styled", property: "font-size", value: 16, binding: "style Body/M -" },
            { node: "Bound", property: "font-size", value: 14, binding: "variable spacing/4 -" },
            { node: "Plain", property: "font-size", value: 16, binding: undefined },
        ]);
    });

    it("leaves out hidden layers, instances, masks, sections and the shapes of boolean operations", async () => {
        const root = page("Page", [
            rect("Hidden", BOX, [solid("#000000")], { visible: false }),
            group("Hidden group", BOX, [rect("Inside hidden", BOX, [solid("#000000")])], { visible: false }),
            { ...frame("Instance", BOX, [solid("#000000")], [rect("Inside instance", BOX, [solid("#000000")])]), type: "INSTANCE" },
            rect("Mask", BOX, [solid("#000000")], { isMask: true }),
            { ...frame("Section", BOX, [solid("#000000")], [rect("In section", BOX, [solid("#000000")])]), type: "SECTION" },
            { ...group("Icon", BOX, [rect("Cut", BOX, [solid("#000000")])]), type: "BOOLEAN_OPERATION", fills: [solid("#111111")] },
        ]);

        expect((await sample(root)).map((entry) => entry.node)).toEqual(["In section", "Icon"]);
    });

    it("names the layer, its path and a missing variable", async () => {
        const root = page("Home", [frame("Card", BOX, [], [rect("Swatch", BOX, [boundSolid("#000000", "var:deleted")])])]);

        const [entry] = await new FigmaUsageSampler().sample([root], true);

        expect(entry.node).toEqual({ id: "rect:Swatch", name: "Swatch", path: "Home / Card" });
        expect(entry.sample).toMatchObject({ id: "rect:Swatch#0", label: "Swatch", binding: { kind: "variable", name: "missing variable" } });
    });
});
