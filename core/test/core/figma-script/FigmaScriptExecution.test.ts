/**
 * Runs a generated script against a stand-in Figma API.
 *
 * Asserting on substrings proves the script says the right things; running it
 * proves it does them. This catches generation bugs a text check cannot see,
 * such as a syntax error or an alias pointing at a variable created later.
 */

import { describe, expect, it } from "vitest";

import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import { FigmaScriptTokenConverter } from "#/core/platforms/figma-script/FigmaScriptTokenConverter";

interface FakeVariable {
    id: string;
    name: string;
    resolvedType: string;
    description: string;
    scopes: string[];
    valuesByMode: Record<string, unknown>;
}

interface FakeCollection {
    id: string;
    name: string;
    modes: Array<{ modeId: string; name: string }>;
    defaultModeId: string;
}

interface FakeFigma {
    collections: FakeCollection[];
    variables: FakeVariable[];
    textStyles: Array<Record<string, unknown>>;
    effectStyles: Array<Record<string, unknown>>;
    logs: string[];
}

/** Builds a Figma stand-in holding everything the runtime touches. */
function createFakeFigma(): { api: Record<string, unknown>; state: FakeFigma; console: unknown } {
    const state: FakeFigma = {
        collections: [],
        variables: [],
        textStyles: [],
        effectStyles: [],
        logs: [],
    };

    let nextId = 1;
    const makeId = (prefix: string): string => `${prefix}:${nextId++}`;

    const api = {
        variables: {
            createVariableCollection: (name: string): FakeCollection => {
                const defaultModeId = makeId("mode");
                const collection: FakeCollection = {
                    id: makeId("collection"),
                    name,
                    modes: [{ modeId: defaultModeId, name: "Mode 1" }],
                    defaultModeId,
                    renameMode(modeId: string, newName: string) {
                        const mode = collection.modes.find((entry) => entry.modeId === modeId);
                        if (mode === undefined) {
                            throw new Error(`Unknown mode ${modeId}`);
                        }

                        mode.name = newName;
                    },
                    addMode(modeName: string) {
                        const modeId = makeId("mode");
                        collection.modes.push({ modeId, name: modeName });
                        return modeId;
                    },
                } as FakeCollection;

                state.collections.push(collection);
                return collection;
            },
            createVariable: (name: string, collection: FakeCollection, resolvedType: string): FakeVariable => {
                const variable: FakeVariable = {
                    id: makeId("variable"),
                    name,
                    resolvedType,
                    description: "",
                    scopes: [],
                    valuesByMode: {},
                    setValueForMode(modeId: string, value: unknown) {
                        if (!collection.modes.some((mode) => mode.modeId === modeId)) {
                            throw new Error(`Mode ${modeId} is not in ${collection.name}`);
                        }

                        variable.valuesByMode[modeId] = value;
                    },
                } as FakeVariable;

                state.variables.push(variable);
                return variable;
            },
            getLocalVariableCollectionsAsync: async () => [...state.collections],
            getLocalVariablesAsync: async () => [...state.variables],
        },
        createTextStyle: () => {
            const style: Record<string, unknown> = { id: makeId("style"), name: "", description: "" };
            state.textStyles.push(style);
            return style;
        },
        createEffectStyle: () => {
            const style: Record<string, unknown> = { id: makeId("style"), name: "", description: "" };
            state.effectStyles.push(style);
            return style;
        },
        getLocalTextStylesAsync: async () => [...state.textStyles],
        getLocalEffectStylesAsync: async () => [...state.effectStyles],
        loadFontAsync: async () => {},
    };

    const fakeConsole = {
        log: (message: string) => state.logs.push(message),
        warn: (message: string) => state.logs.push(message),
    };

    return { api, state, console: fakeConsole };
}

/** Generates a script for the given tokens and runs it against the stand-in. */
async function run(base: object, themes: Record<string, object> = {}): Promise<FakeFigma> {
    const reader = new DtcgJsonReader();
    const list = new DtcgList(
        reader.parse(JSON.stringify(base)),
        new Map(Object.entries(themes).map(([name, doc]) => [name, reader.parse(JSON.stringify(doc))])),
    );

    const script = new FigmaScriptTokenConverter().convertList(list);
    const { api, state, console: fakeConsole } = createFakeFigma();

    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as
        new (...args: string[]) => (figma: unknown, console: unknown) => Promise<void>;

    await new AsyncFunction("figma", "console", script)(api, fakeConsole);
    return state;
}

function color(components: [number, number, number]): object {
    return { $type: "color", $value: { colorSpace: "srgb", components, alpha: 1 } };
}

describe("generated Figma script", () => {
    it("creates a collection per layer and links the alias chain", async () => {
        const state = await run({
            primitive: { color: { brand: { ...color([0, 0, 1]), $description: "Brand." } } },
            semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
            component: { button: { primary: { background: { $value: "{semantic.color.action}" } } } },
        });

        expect(state.collections.map((entry) => entry.name))
            .toEqual(["Primitive", "Semantic", "Component"]);
        expect(state.variables.map((entry) => entry.name)).toEqual([
            "primitive/color/brand",
            "semantic/color/action",
            "component/button/primary/background",
        ]);

        const [primitive, semantic, component] = state.variables;
        expect(primitive!.description).toBe("Brand.");
        expect(Object.values(semantic!.valuesByMode)[0])
            .toEqual({ type: "VARIABLE_ALIAS", id: primitive!.id });
        expect(Object.values(component!.valuesByMode)[0])
            .toEqual({ type: "VARIABLE_ALIAS", id: semantic!.id });
    });

    it("names the default mode and adds one mode per theme", async () => {
        const state = await run(
            { primitive: { color: { brand: color([0, 0, 1]) } } },
            { dark: { primitive: { color: { brand: color([1, 1, 1]) } } } },
        );

        expect(state.collections[0]?.modes.map((mode) => mode.name)).toEqual(["Light", "Dark"]);
        expect(Object.keys(state.variables[0]!.valuesByMode)).toHaveLength(2);
    });

    it("creates text and effect styles", async () => {
        const state = await run({
            primitive: {
                typography: {
                    body: {
                        $type: "typography",
                        $value: {
                            fontFamily: "Inter",
                            fontSize: { value: 16, unit: "px" },
                            fontWeight: 400,
                            letterSpacing: { value: 0, unit: "px" },
                            lineHeight: 1.5,
                        },
                    },
                },
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

        expect(state.textStyles[0]).toMatchObject({
            name: "primitive/typography/body",
            fontSize: 16,
            // A unitless DTCG multiplier becomes the percentage Figma stores.
            lineHeight: { value: 150, unit: "PERCENT" },
        });
        expect(state.effectStyles[0]).toMatchObject({ name: "primitive/shadow/surface" });
    });

    it("leaves no duplicates when run twice against the same document", async () => {
        const tokens = {
            primitive: { color: { brand: color([0, 0, 1]) } },
            semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
        };

        const reader = new DtcgJsonReader();
        const list = new DtcgList(reader.parse(JSON.stringify(tokens)), new Map());
        const script = new FigmaScriptTokenConverter().convertList(list);
        const { api, state, console: fakeConsole } = createFakeFigma();

        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as
            new (...args: string[]) => (figma: unknown, console: unknown) => Promise<void>;
        const execute = new AsyncFunction("figma", "console", script);

        await execute(api, fakeConsole);
        await execute(api, fakeConsole);

        expect(state.collections).toHaveLength(2);
        expect(state.variables).toHaveLength(2);
    });

    it("reports what it did", async () => {
        const state = await run({ primitive: { color: { brand: color([0, 0, 1]) } } });

        expect(state.logs.join("\n")).toContain("Design tokens applied");
    });

    it("explains a rejected mode once instead of per variable", async () => {
        // Figma refuses extra modes on a free plan. The report has to name that
        // reason once, not repeat a message for every variable wanting the mode.
        const reader = new DtcgJsonReader();
        const list = new DtcgList(
            reader.parse(JSON.stringify({
                primitive: {
                    color: {
                        first: color([0, 0, 1]),
                        second: color([0, 1, 0]),
                        third: color([1, 0, 0]),
                    },
                },
            })),
            new Map([["dark", reader.parse(JSON.stringify({
                primitive: {
                    color: {
                        first: color([1, 1, 1]),
                        second: color([1, 1, 1]),
                        third: color([1, 1, 1]),
                    },
                },
            }))]]),
        );

        const script = new FigmaScriptTokenConverter().convertList(list);
        const { api, state, console: fakeConsole } = createFakeFigma();

        // Stand in for a plan that allows a single mode per collection.
        const variables = api["variables"] as Record<string, unknown>;
        const createCollection = variables["createVariableCollection"] as (name: string) => {
            addMode: (name: string) => string;
        };
        variables["createVariableCollection"] = (name: string) => {
            const collection = createCollection(name);
            collection.addMode = () => {
                throw new Error("Upgrade to a paid plan to use multiple modes");
            };
            return collection;
        };

        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as
            new (...args: string[]) => (figma: unknown, console: unknown) => Promise<void>;
        await new AsyncFunction("figma", "console", script)(api, fakeConsole);

        const rejections = state.logs.filter((line) => line.includes('Mode "Dark"'));
        const perVariable = state.logs.filter((line) => line.includes("is unavailable"));

        expect(rejections).toHaveLength(1);
        expect(rejections[0]).toContain("paid plan");
        expect(perVariable).toEqual([]);
    });

    it("reports through print where the host provides it", async () => {
        // Scripter shows values through its own `print` and hides `console`
        // output, so the report has to prefer `print` when it exists.
        const reader = new DtcgJsonReader();
        const tokens = { primitive: { color: { brand: color([0, 0, 1]) } } };
        const script = new FigmaScriptTokenConverter()
            .convertList(new DtcgList(reader.parse(JSON.stringify(tokens)), new Map()));

        const { api } = createFakeFigma();
        const printed: string[] = [];
        const unusedConsole = {
            log: () => expect.fail("console must not be used when print exists"),
            warn: () => expect.fail("console must not be used when print exists"),
        };

        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as
            new (...args: string[]) => (
                figma: unknown,
                console: unknown,
                print: unknown,
            ) => Promise<void>;

        await new AsyncFunction("figma", "console", "print", script)(
            api,
            unusedConsole,
            (line: string) => printed.push(line),
        );

        expect(printed.join("\n")).toContain("Design tokens applied");
    });
});
