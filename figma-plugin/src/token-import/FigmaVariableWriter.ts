/**
 * Applies an import plan to the current Figma file.
 *
 * This is the only module in `token-import` that touches the Figma API. Keeping
 * the writer thin and the planning pure makes the plan testable on its own and
 * allows a dry run to reuse everything except this file.
 */

import {
    BASE_MODE_NAME,
    type PlannedEffectStyle,
    type PlannedTextStyle,
    type PlannedValue,
    type PlannedVariable,
    type TokenImportPlan,
} from "#/figma-plugin/token-import/TokenImportPlan";

export async function applyImportPlan(
    plan: TokenImportPlan,
    strategy: ImportStrategy,
): Promise<WriteResult> {
    const counts: WriteCounts = {
        collectionsCreated: 0,
        modesCreated: 0,
        variablesCreated: 0,
        variablesUpdated: 0,
        stylesCreated: 0,
        stylesUpdated: 0,
        entitiesRemoved: 0,
    };
    const warnings: string[] = [];

    const collections = await resolveCollections(plan, counts, warnings);
    const variables = await writeVariables(plan, collections, counts, warnings);

    await writeTextStyles(plan.textStyles, counts, warnings);
    await writeEffectStyles(plan.effectStyles, counts, warnings);

    if (strategy === "replace") {
        await removeStaleEntities(plan, variables, counts, warnings);
    }

    return { counts, warnings };
}

/** How an existing file is treated when it already holds imported entities. */
export type ImportStrategy = "merge" | "replace";

export interface WriteResult {
    counts: WriteCounts;
    warnings: string[];
}

export interface WriteCounts {
    collectionsCreated: number;
    modesCreated: number;
    variablesCreated: number;
    variablesUpdated: number;
    stylesCreated: number;
    stylesUpdated: number;
    entitiesRemoved: number;
}

interface ResolvedCollection {
    collection: VariableCollection;
    /** Figma mode id per planned mode name. */
    modeIds: Map<string, string>;
}

async function resolveCollections(
    plan: TokenImportPlan,
    counts: WriteCounts,
    warnings: string[],
): Promise<Map<string, ResolvedCollection>> {
    const existing = await figma.variables.getLocalVariableCollectionsAsync();
    const byName = new Map(existing.map((collection) => [collection.name, collection]));
    const resolved = new Map<string, ResolvedCollection>();

    for (const [name, modes] of plan.collections) {
        let collection = byName.get(name);
        if (collection === undefined) {
            collection = figma.variables.createVariableCollection(name);
            counts.collectionsCreated += 1;
        }

        resolved.set(name, {
            collection,
            modeIds: resolveModes(collection, modes, counts, warnings),
        });
    }

    return resolved;
}

/**
 * Maps planned mode names onto Figma modes.
 *
 * The base mode is renamed rather than added: a new collection already has a
 * default mode, and the exporter writes the default mode to `tokens.json`.
 */
function resolveModes(
    collection: VariableCollection,
    modes: string[],
    counts: WriteCounts,
    warnings: string[],
): Map<string, string> {
    const modeIds = new Map<string, string>();
    const byName = new Map(collection.modes.map((mode) => [mode.name, mode.modeId]));

    for (const [index, name] of modes.entries()) {
        const existingId = byName.get(name);
        if (existingId !== undefined) {
            modeIds.set(name, existingId);
            continue;
        }

        if (index === 0) {
            collection.renameMode(collection.defaultModeId, name);
            modeIds.set(name, collection.defaultModeId);
            continue;
        }

        try {
            const modeId = collection.addMode(name);
            modeIds.set(name, modeId);
            counts.modesCreated += 1;
        } catch (error: unknown) {
            warnings.push(`${collection.name}: mode "${name}" was not created. ${toMessage(error)}`);
        }
    }

    return modeIds;
}

async function writeVariables(
    plan: TokenImportPlan,
    collections: Map<string, ResolvedCollection>,
    counts: WriteCounts,
    warnings: string[],
): Promise<Map<string, Variable>> {
    const existing = await figma.variables.getLocalVariablesAsync();
    const byName = new Map(existing.map((variable) => [variable.name, variable]));
    const byPath = new Map<string, Variable>();

    for (const planned of plan.variables) {
        const target = collections.get(planned.collection);
        if (target === undefined) {
            warnings.push(`${planned.path}: collection "${planned.collection}" is unavailable.`);
            continue;
        }

        const variable = resolveVariable(planned, target.collection, byName, counts, warnings);
        if (variable === undefined) {
            continue;
        }

        byPath.set(planned.path, variable);
        applyVariableMetadata(variable, planned);
        applyVariableValues(planned, variable, target, byPath, warnings);
    }

    return byPath;
}

function resolveVariable(
    planned: PlannedVariable,
    collection: VariableCollection,
    byName: Map<string, Variable>,
    counts: WriteCounts,
    warnings: string[],
): Variable | undefined {
    const existing = byName.get(planned.name);
    if (existing !== undefined) {
        // A variable's type is fixed at creation, so a type change needs a rebuild.
        if (existing.resolvedType !== planned.resolvedType) {
            warnings.push(
                `${planned.path}: existing variable has type ${existing.resolvedType}, expected `
                + `${planned.resolvedType}. Remove it and import again.`,
            );
            return undefined;
        }

        counts.variablesUpdated += 1;
        return existing;
    }

    try {
        const created = figma.variables.createVariable(
            planned.name,
            collection,
            planned.resolvedType,
        );
        byName.set(planned.name, created);
        counts.variablesCreated += 1;
        return created;
    } catch (error: unknown) {
        warnings.push(`${planned.path}: variable was not created. ${toMessage(error)}`);
        return undefined;
    }
}

function applyVariableMetadata(variable: Variable, planned: PlannedVariable): void {
    if (planned.description !== "") {
        variable.description = planned.description;
    }

    if (planned.scopes.length > 0) {
        variable.scopes = planned.scopes;
    }
}

function applyVariableValues(
    planned: PlannedVariable,
    variable: Variable,
    target: ResolvedCollection,
    byPath: Map<string, Variable>,
    warnings: string[],
): void {
    for (const [modeName, value] of planned.valuesByMode) {
        const modeId = target.modeIds.get(modeName);
        if (modeId === undefined) {
            warnings.push(`${planned.path}: mode "${modeName}" is unavailable.`);
            continue;
        }

        const resolved = toVariableValue(value, byPath);
        if (resolved === undefined) {
            warnings.push(`${planned.path}: value for mode "${modeName}" could not be resolved.`);
            continue;
        }

        try {
            variable.setValueForMode(modeId, resolved);
        } catch (error: unknown) {
            warnings.push(`${planned.path}: mode "${modeName}" was not set. ${toMessage(error)}`);
        }
    }
}

function toVariableValue(
    value: PlannedValue,
    byPath: Map<string, Variable>,
): VariableValue | undefined {
    if (value.kind === "color") {
        return value.color;
    }

    if (value.kind === "number") {
        return value.value;
    }

    const target = byPath.get(value.path);
    if (target === undefined) {
        return undefined;
    }

    return { type: "VARIABLE_ALIAS", id: target.id };
}

async function writeTextStyles(
    planned: PlannedTextStyle[],
    counts: WriteCounts,
    warnings: string[],
): Promise<void> {
    const existing = await figma.getLocalTextStylesAsync();
    const byName = new Map(existing.map((style) => [style.name, style]));

    for (const entry of planned) {
        const fontName = { family: entry.typography.fontFamily, style: entry.typography.fontStyle };

        try {
            await figma.loadFontAsync(fontName);
        } catch (error: unknown) {
            warnings.push(
                `${entry.path}: font ${fontName.family} ${fontName.style} is unavailable. `
                + toMessage(error),
            );
            continue;
        }

        const style = byName.get(entry.name) ?? createTextStyle(entry.name, counts, byName);
        style.fontName = fontName;
        style.fontSize = entry.typography.fontSize;
        style.letterSpacing = { value: entry.typography.letterSpacing, unit: "PIXELS" };
        // DTCG stores a unitless multiplier; Figma stores a percentage.
        style.lineHeight = { value: entry.typography.lineHeight * 100, unit: "PERCENT" };

        if (entry.description !== "") {
            style.description = entry.description;
        }
    }
}

function createTextStyle(
    name: string,
    counts: WriteCounts,
    byName: Map<string, TextStyle>,
): TextStyle {
    const style = figma.createTextStyle();
    style.name = name;
    byName.set(name, style);
    counts.stylesCreated += 1;
    return style;
}

async function writeEffectStyles(
    planned: PlannedEffectStyle[],
    counts: WriteCounts,
    warnings: string[],
): Promise<void> {
    const existing = await figma.getLocalEffectStylesAsync();
    const byName = new Map(existing.map((style) => [style.name, style]));

    for (const entry of planned) {
        let style = byName.get(entry.name);
        if (style === undefined) {
            style = figma.createEffectStyle();
            style.name = entry.name;
            byName.set(entry.name, style);
            counts.stylesCreated += 1;
        } else {
            counts.stylesUpdated += 1;
        }

        try {
            style.effects = entry.effects as readonly Effect[];
        } catch (error: unknown) {
            warnings.push(`${entry.path}: effects were not applied. ${toMessage(error)}`);
            continue;
        }

        if (entry.description !== "") {
            style.description = entry.description;
        }
    }
}

/**
 * Removes imported entities that the plan no longer contains.
 *
 * Deletion is limited to names carrying a known layer prefix, so entities a
 * designer created by hand are never touched.
 */
async function removeStaleEntities(
    plan: TokenImportPlan,
    variables: Map<string, Variable>,
    counts: WriteCounts,
    warnings: string[],
): Promise<void> {
    const keptVariableIds = new Set([...variables.values()].map((variable) => variable.id));
    const keptStyleNames = new Set([
        ...plan.textStyles.map((style) => style.name),
        ...plan.effectStyles.map((style) => style.name),
    ]);

    for (const variable of await figma.variables.getLocalVariablesAsync()) {
        if (keptVariableIds.has(variable.id) || !isImportedName(variable.name)) {
            continue;
        }

        counts.entitiesRemoved += remove(variable, variable.name, warnings);
    }

    const styles: BaseStyle[] = [
        ...await figma.getLocalTextStylesAsync(),
        ...await figma.getLocalEffectStylesAsync(),
    ];

    for (const style of styles) {
        if (keptStyleNames.has(style.name) || !isImportedName(style.name)) {
            continue;
        }

        counts.entitiesRemoved += remove(style, style.name, warnings);
    }
}

function remove(entity: { remove: () => void }, name: string, warnings: string[]): number {
    try {
        entity.remove();
        return 1;
    } catch (error: unknown) {
        // Removal fails while the entity is still bound to a node.
        warnings.push(`${name}: entity was not removed. ${toMessage(error)}`);
        return 0;
    }
}

const IMPORTED_NAME_PATTERN = /^(primitive|semantic|component)\//;

function isImportedName(name: string): boolean {
    return IMPORTED_NAME_PATTERN.test(name);
}

function toMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export { BASE_MODE_NAME };
