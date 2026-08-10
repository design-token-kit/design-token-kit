/**
 * The runtime half of a generated Figma script.
 *
 * A generated script is data plus this engine: the converter emits collections,
 * variables and styles as literals, and this code applies them through the
 * Figma Plugin API. The engine never varies with the token set, so it is kept
 * as text rather than generated.
 *
 * The code runs inside a Figma plugin sandbox, where `figma` is a global. It
 * avoids `figma.ui`, which Scripter disables, so the same script runs both in
 * Scripter and in a plugin of your own.
 */
export const FIGMA_SCRIPT_RUNTIME = `
async function applyTokens() {
    const report = {
        collectionsCreated: 0,
        modesCreated: 0,
        variablesCreated: 0,
        variablesUpdated: 0,
        stylesCreated: 0,
        stylesUpdated: 0,
        warnings: [],
        unavailableModes: new Set(),
    };

    const collections = await resolveCollections(report);
    await applyVariables(collections, report);

    await applyTextStyles(report);
    await applyEffectStyles(report);

    printReport(report);
    return report;
}

/**
 * Finds each planned collection by name, creating the missing ones.
 */
async function resolveCollections(report) {
    const existing = await figma.variables.getLocalVariableCollectionsAsync();
    const byName = new Map(existing.map((entry) => [entry.name, entry]));
    const resolved = new Map();

    for (const planned of COLLECTIONS) {
        let collection = byName.get(planned.name);
        if (collection === undefined) {
            collection = figma.variables.createVariableCollection(planned.name);
            report.collectionsCreated += 1;
        }

        resolved.set(planned.name, {
            collection,
            modeIds: resolveModes(collection, planned.modes, report),
        });
    }

    return resolved;
}

/**
 * Maps planned mode names onto Figma modes.
 *
 * The first mode renames the collection default rather than adding a mode: a
 * collection always has one, and the export path reads the default mode as the
 * base token file.
 */
function resolveModes(collection, modes, report) {
    const modeIds = new Map();
    const byName = new Map(collection.modes.map((mode) => [mode.name, mode.modeId]));

    modes.forEach((name, index) => {
        const existing = byName.get(name);
        if (existing !== undefined) {
            modeIds.set(name, existing);
            return;
        }

        if (index === 0) {
            collection.renameMode(collection.defaultModeId, name);
            modeIds.set(name, collection.defaultModeId);
            return;
        }

        try {
            modeIds.set(name, collection.addMode(name));
            report.modesCreated += 1;
        } catch (error) {
            // Modes beyond the first need a paid Figma plan. Naming the reason
            // once here keeps it from being buried under one message per
            // variable that wanted the mode.
            report.unavailableModes.add(name);
            report.warnings.push(
                'Mode "' + name + '" was not created in ' + collection.name
                + ", so its overrides are skipped. " + message(error),
            );
        }
    });

    return modeIds;
}

/**
 * Creates or updates every variable.
 *
 * VARIABLES is ordered so an alias target always precedes the variable
 * pointing at it, which the Figma API requires.
 */
async function applyVariables(collections, report) {
    const existing = await figma.variables.getLocalVariablesAsync();
    const byName = new Map(existing.map((entry) => [entry.name, entry]));
    const byPath = new Map();

    for (const planned of VARIABLES) {
        const target = collections.get(planned.collection);
        if (target === undefined) {
            report.warnings.push(planned.path + ': collection "' + planned.collection + '" is unavailable.');
            continue;
        }

        const variable = resolveVariable(planned, target.collection, byName, report);
        if (variable === undefined) {
            continue;
        }

        byPath.set(planned.path, variable);

        if (planned.description) {
            variable.description = planned.description;
        }
        if (planned.scopes && planned.scopes.length > 0) {
            variable.scopes = planned.scopes;
        }

        applyValues(planned, variable, target.modeIds, byPath, report);
    }

    return byPath;
}

function resolveVariable(planned, collection, byName, report) {
    const existing = byName.get(planned.name);
    if (existing !== undefined) {
        // A variable's type is fixed at creation, so a changed type needs a rebuild.
        if (existing.resolvedType !== planned.resolvedType) {
            report.warnings.push(
                planned.path + ": existing variable is " + existing.resolvedType
                + ", expected " + planned.resolvedType + ". Remove it and run again.",
            );
            return undefined;
        }

        report.variablesUpdated += 1;
        return existing;
    }

    try {
        const created = figma.variables.createVariable(planned.name, collection, planned.resolvedType);
        byName.set(planned.name, created);
        report.variablesCreated += 1;
        return created;
    } catch (error) {
        report.warnings.push(planned.path + ": variable was not created. " + message(error));
        return undefined;
    }
}

function applyValues(planned, variable, modeIds, byPath, report) {
    for (const mode of Object.keys(planned.values)) {
        const modeId = modeIds.get(mode);
        if (modeId === undefined) {
            // A mode reported as unavailable was already explained once.
            if (!report.unavailableModes.has(mode)) {
                report.warnings.push(planned.path + ': mode "' + mode + '" is unavailable.');
            }

            continue;
        }

        const value = toVariableValue(planned.values[mode], byPath);
        if (value === undefined) {
            report.warnings.push(planned.path + ': value for mode "' + mode + '" could not be resolved.');
            continue;
        }

        try {
            variable.setValueForMode(modeId, value);
        } catch (error) {
            report.warnings.push(planned.path + ': mode "' + mode + '" was not set. ' + message(error));
        }
    }
}

function toVariableValue(value, byPath) {
    if (value.alias === undefined) {
        return value.value;
    }

    const target = byPath.get(value.alias);
    return target === undefined
        ? undefined
        : { type: "VARIABLE_ALIAS", id: target.id };
}

async function applyTextStyles(report) {
    const existing = await figma.getLocalTextStylesAsync();
    const byName = new Map(existing.map((entry) => [entry.name, entry]));

    for (const planned of TEXT_STYLES) {
        const fontName = { family: planned.fontFamily, style: planned.fontStyle };

        try {
            await figma.loadFontAsync(fontName);
        } catch (error) {
            report.warnings.push(
                planned.path + ": font " + fontName.family + " " + fontName.style
                + " is unavailable. " + message(error),
            );
            continue;
        }

        let style = byName.get(planned.name);
        if (style === undefined) {
            style = figma.createTextStyle();
            style.name = planned.name;
            byName.set(planned.name, style);
            report.stylesCreated += 1;
        } else {
            report.stylesUpdated += 1;
        }

        style.fontName = fontName;
        style.fontSize = planned.fontSize;
        style.letterSpacing = { value: planned.letterSpacing, unit: "PIXELS" };
        // DTCG stores a unitless multiplier where Figma stores a percentage.
        style.lineHeight = { value: planned.lineHeight * 100, unit: "PERCENT" };

        if (planned.description) {
            style.description = planned.description;
        }
    }
}

async function applyEffectStyles(report) {
    const existing = await figma.getLocalEffectStylesAsync();
    const byName = new Map(existing.map((entry) => [entry.name, entry]));

    for (const planned of EFFECT_STYLES) {
        let style = byName.get(planned.name);
        if (style === undefined) {
            style = figma.createEffectStyle();
            style.name = planned.name;
            byName.set(planned.name, style);
            report.stylesCreated += 1;
        } else {
            report.stylesUpdated += 1;
        }

        try {
            style.effects = planned.effects.map(toEffect);
        } catch (error) {
            report.warnings.push(planned.path + ": effects were not applied. " + message(error));
            continue;
        }

        if (planned.description) {
            style.description = planned.description;
        }
    }
}

function toEffect(shadow) {
    return {
        type: shadow.type,
        color: shadow.color,
        offset: shadow.offset,
        radius: shadow.radius,
        spread: shadow.spread,
        visible: true,
        blendMode: "NORMAL",
    };
}

/**
 * Prints what happened, problems first.
 *
 * A warning explains why part of the import did not land, so it is more useful
 * than the counts and comes before them.
 */
function printReport(report) {
    for (const warning of report.warnings) {
        printLine(warning);
    }

    printLine(
        "Design tokens applied: "
        + report.collectionsCreated + " collections created, "
        + report.modesCreated + " modes created, "
        + report.variablesCreated + " variables created, "
        + report.variablesUpdated + " updated, "
        + report.stylesCreated + " styles created, "
        + report.stylesUpdated + " updated.",
    );

    if (SKIPPED.length > 0) {
        printLine("Not representable in Figma: " + SKIPPED.length + " tokens.");
        for (const group of groupSkipped()) {
            printLine("  " + group.type + " (" + group.paths.length + "): " + group.reason);
        }
    }
}

/**
 * Groups skipped tokens by type so the summary stays short.
 */
function groupSkipped() {
    const byType = new Map();

    for (const entry of SKIPPED) {
        const group = byType.get(entry.type) || { type: entry.type, reason: entry.reason, paths: [] };
        group.paths.push(entry.path);
        byType.set(entry.type, group);
    }

    return Array.from(byType.values());
}

function message(error) {
    return error && error.message ? error.message : String(error);
}

/**
 * Writes one line of the report.
 *
 * Scripter shows values through its own \`print\`, leaving \`console\` output
 * out of sight, while a plugin has \`console\` and no \`print\`. Preferring
 * \`print\` keeps the report visible in both.
 */
function printLine(line) {
    if (typeof print === "function") {
        print(line);
        return;
    }

    console.log(line);
}

await applyTokens();
`.trim();
