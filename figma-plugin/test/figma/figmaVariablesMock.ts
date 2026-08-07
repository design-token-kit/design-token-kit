/**
 * In-memory Figma variables and styles, shared by the import and round-trip tests.
 *
 * The read side must stay shape-compatible with what `TokenExporter` consumes
 * (`valuesByMode`, `variableCollectionId`, `resolvedType`, `scopes`,
 * `description`). That compatibility is what makes a round-trip test possible:
 * the importer writes into this store and the exporter reads back out of it.
 */

interface MockMode {
    modeId: string;
    name: string;
}

export interface MockVariableCollection {
    id: string;
    name: string;
    modes: MockMode[];
    defaultModeId: string;
    renameMode: (modeId: string, name: string) => void;
    addMode: (name: string) => string;
    remove: () => void;
}

export interface MockVariable {
    id: string;
    name: string;
    variableCollectionId: string;
    resolvedType: "COLOR" | "FLOAT";
    scopes: string[];
    description: string;
    valuesByMode: Record<string, unknown>;
    setValueForMode: (modeId: string, value: unknown) => void;
    remove: () => void;
}

export interface MockStyle {
    id: string;
    name: string;
    description: string;
    remove: () => void;
    [key: string]: unknown;
}

export interface FigmaVariablesMock {
    figma: Record<string, unknown>;
    collections: MockVariableCollection[];
    variables: MockVariable[];
    textStyles: MockStyle[];
    effectStyles: MockStyle[];
}

export function createFigmaVariablesMock(): FigmaVariablesMock {
    const collections: MockVariableCollection[] = [];
    const variables: MockVariable[] = [];
    const textStyles: MockStyle[] = [];
    const effectStyles: MockStyle[] = [];

    let nextId = 1;
    const makeId = (prefix: string): string => `${prefix}:${nextId++}`;

    const createVariableCollection = (name: string): MockVariableCollection => {
        const defaultModeId = makeId("mode");
        const collection: MockVariableCollection = {
            id: makeId("collection"),
            name,
            modes: [{ modeId: defaultModeId, name: "Mode 1" }],
            defaultModeId,
            renameMode(modeId, newName) {
                const mode = collection.modes.find((entry) => entry.modeId === modeId);
                if (mode === undefined) {
                    throw new Error(`Unknown mode ${modeId}`);
                }

                mode.name = newName;
            },
            addMode(modeName) {
                const modeId = makeId("mode");
                collection.modes.push({ modeId, name: modeName });
                return modeId;
            },
            remove() {
                remove(collections, collection);
            },
        };

        collections.push(collection);
        return collection;
    };

    const createVariable = (
        name: string,
        collection: MockVariableCollection,
        resolvedType: "COLOR" | "FLOAT",
    ): MockVariable => {
        if (variables.some((entry) => entry.name === name)) {
            throw new Error(`Variable ${name} already exists`);
        }

        const variable: MockVariable = {
            id: makeId("variable"),
            name,
            variableCollectionId: collection.id,
            resolvedType,
            scopes: [],
            description: "",
            valuesByMode: {},
            setValueForMode(modeId, value) {
                if (!collection.modes.some((mode) => mode.modeId === modeId)) {
                    throw new Error(`Mode ${modeId} does not belong to ${collection.name}`);
                }

                variable.valuesByMode[modeId] = value;
            },
            remove() {
                remove(variables, variable);
            },
        };

        variables.push(variable);
        return variable;
    };

    const createStyle = (store: MockStyle[]): MockStyle => {
        const style: MockStyle = {
            id: makeId("style"),
            name: "",
            description: "",
            remove() {
                remove(store, style);
            },
        };

        store.push(style);
        return style;
    };

    const figma: Record<string, unknown> = {
        variables: {
            createVariableCollection,
            createVariable,
            getLocalVariableCollectionsAsync: async () => [...collections],
            getLocalVariablesAsync: async (type?: string) => (
                type === undefined
                    ? [...variables]
                    : variables.filter((variable) => variable.resolvedType === type)
            ),
        },
        createTextStyle: () => createStyle(textStyles),
        createEffectStyle: () => createStyle(effectStyles),
        getLocalTextStylesAsync: async () => [...textStyles],
        getLocalEffectStylesAsync: async () => [...effectStyles],
        getLocalPaintStylesAsync: async () => [],
        loadFontAsync: async () => {},
    };

    return { figma, collections, variables, textStyles, effectStyles };
}

function remove<T>(store: T[], entry: T): void {
    const index = store.indexOf(entry);
    if (index >= 0) {
        store.splice(index, 1);
    }
}
