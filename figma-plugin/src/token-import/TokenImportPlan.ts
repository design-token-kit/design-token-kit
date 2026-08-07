/**
 * Builds a Figma-free plan from DTCG token documents.
 *
 * This module performs all import decisions without touching the Figma API, so
 * it is unit-testable on its own and can back a dry-run preview.
 */

import { orderByDependency, toReferencePath } from "#/figma-plugin/token-import/AliasResolver";
import { mapFigmaName } from "#/figma-plugin/token-import/FigmaNameMapper";
import {
    isSupportedTokenType,
    toFigmaColor,
    toFigmaDimension,
    toFigmaNumber,
    toFigmaShadow,
    toFigmaTypography,
    toUnsupportedReason,
    type FigmaShadowEffect,
    type FigmaTypography,
    type RgbaColor,
} from "#/figma-plugin/token-import/TokenValueConverter";

/**
 * Builds an import plan from a base document and any theme documents.
 *
 * The first document is the base; each further document becomes a mode named
 * after its file name, mirroring the exporter's `tokens.<mode>.json` convention.
 */
export function buildImportPlan(documents: TokenDocument[]): TokenImportPlan {
    const plan: TokenImportPlan = {
        collections: new Map(),
        variables: [],
        textStyles: [],
        effectStyles: [],
        skipped: [],
        warnings: [],
    };

    if (documents.length === 0) {
        plan.warnings.push("No token documents were provided.");
        return plan;
    }

    const [base, ...themes] = documents;
    const variablesByPath = new Map<string, PlannedVariable>();

    addDocument(plan, variablesByPath, base!, BASE_MODE_NAME, true);
    for (const theme of themes) {
        addDocument(plan, variablesByPath, theme, toModeName(theme.fileName), false);
    }

    plan.variables = orderVariables(plan, [...variablesByPath.values()]);
    reportUnresolvedAliases(plan, variablesByPath);

    return plan;
}

/**
 * Mode name for the base document.
 *
 * The exporter writes a collection's default mode to `tokens.json`, so naming
 * the default mode `Light` keeps the round trip symmetric.
 */
export const BASE_MODE_NAME = "Light";

export interface TokenDocument {
    /** Source file name, e.g. `tokens.json` or `tokens.dark.json`. */
    fileName: string;
    /** Parsed DTCG document. */
    content: unknown;
}

export interface TokenImportPlan {
    /** Collection name to its ordered mode names, base mode first. */
    collections: Map<string, string[]>;
    /** Variables in creation order: alias targets precede their referents. */
    variables: PlannedVariable[];
    textStyles: PlannedTextStyle[];
    effectStyles: PlannedEffectStyle[];
    skipped: SkippedToken[];
    warnings: string[];
}

export interface PlannedVariable {
    /** Dotted token path, e.g. `primitive.color.brand-500`. */
    path: string;
    /** Figma variable name, e.g. `primitive/color/brand-500`. */
    name: string;
    collection: string;
    resolvedType: "COLOR" | "FLOAT";
    scopes: VariableScope[];
    description: string;
    /** Value per mode name. Modes absent here inherit the base mode. */
    valuesByMode: Map<string, PlannedValue>;
}

export type PlannedValue =
    | { kind: "color"; color: RgbaColor }
    | { kind: "number"; value: number }
    | { kind: "alias"; path: string };

export interface PlannedStyle {
    path: string;
    name: string;
    description: string;
}

export interface PlannedTextStyle extends PlannedStyle {
    typography: FigmaTypography;
}

export interface PlannedEffectStyle extends PlannedStyle {
    effects: FigmaShadowEffect[];
}

export interface SkippedToken {
    path: string;
    type: string;
    reason: string;
}

interface FlatToken {
    path: string[];
    type: string;
    value: unknown;
    description: string;
}

/** Figma variable collection per token layer. */
const COLLECTION_BY_LAYER: Record<string, string> = {
    primitive: "Primitive",
    semantic: "Semantic",
    component: "Component",
};

function addDocument(
    plan: TokenImportPlan,
    variablesByPath: Map<string, PlannedVariable>,
    document: TokenDocument,
    modeName: string,
    isBase: boolean,
): void {
    for (const token of flattenTokens(document.content)) {
        const dotted = token.path.join(".");

        if (!isSupportedTokenType(token.type)) {
            if (isBase) {
                plan.skipped.push({
                    path: dotted,
                    type: token.type,
                    reason: toUnsupportedReason(token.type),
                });
            }

            continue;
        }

        const mapping = mapFigmaName(token.path);
        if (mapping === undefined) {
            plan.warnings.push(
                `${dotted}: token path cannot be represented as a round-trip safe Figma name.`,
            );
            continue;
        }

        const collection = COLLECTION_BY_LAYER[mapping.layer]!;

        if (token.type === "typography" || token.type === "shadow") {
            addStyle(plan, token, mapping.name, dotted, isBase, modeName);
            continue;
        }

        addVariable(plan, variablesByPath, {
            token,
            dotted,
            name: mapping.name,
            collection,
            modeName,
            isBase,
        });
    }
}

interface VariableRequest {
    token: FlatToken;
    dotted: string;
    name: string;
    collection: string;
    modeName: string;
    isBase: boolean;
}

function addVariable(
    plan: TokenImportPlan,
    variablesByPath: Map<string, PlannedVariable>,
    request: VariableRequest,
): void {
    const { token, dotted, name, collection, modeName, isBase } = request;

    const value = toPlannedValue(plan, token, dotted);
    if (value === undefined) {
        return;
    }

    const existing = variablesByPath.get(dotted);
    if (existing !== undefined) {
        existing.valuesByMode.set(modeName, value);
        if (existing.description === "" && token.description !== "") {
            existing.description = token.description;
        }

        registerMode(plan, existing.collection, modeName);
        return;
    }

    if (!isBase) {
        plan.warnings.push(
            `${dotted}: theme "${modeName}" overrides a token that is absent from the base document.`,
        );
    }

    const variable: PlannedVariable = {
        path: dotted,
        name,
        collection,
        resolvedType: token.type === "color" ? "COLOR" : "FLOAT",
        scopes: toScopes(token),
        description: token.description,
        valuesByMode: new Map([[modeName, value]]),
    };

    variablesByPath.set(dotted, variable);
    registerMode(plan, collection, modeName);
}

function toPlannedValue(
    plan: TokenImportPlan,
    token: FlatToken,
    dotted: string,
): PlannedValue | undefined {
    const reference = toReferencePath(token.value);
    if (reference !== undefined) {
        return { kind: "alias", path: reference };
    }

    if (token.type === "color") {
        const color = toFigmaColor(token.value);
        if (color === undefined) {
            plan.warnings.push(`${dotted}: color value cannot be read.`);
            return undefined;
        }

        return { kind: "color", color };
    }

    if (token.type === "dimension") {
        const dimension = toFigmaDimension(token.value);
        if (dimension === undefined) {
            plan.warnings.push(`${dotted}: dimension value cannot be read.`);
            return undefined;
        }

        if (dimension.converted) {
            plan.warnings.push(`${dotted}: rem value converted to pixels at 16px per rem.`);
        }

        return { kind: "number", value: dimension.value };
    }

    const value = toFigmaNumber(token.value);
    if (value === undefined) {
        plan.warnings.push(`${dotted}: number value cannot be read.`);
        return undefined;
    }

    return { kind: "number", value };
}

function addStyle(
    plan: TokenImportPlan,
    token: FlatToken,
    name: string,
    dotted: string,
    isBase: boolean,
    modeName: string,
): void {
    // Figma styles carry no modes, so only the base document defines them.
    if (!isBase) {
        plan.warnings.push(
            `${dotted}: theme "${modeName}" cannot override a style; Figma styles have no modes.`,
        );
        return;
    }

    if (toReferencePath(token.value) !== undefined) {
        plan.skipped.push({
            path: dotted,
            type: token.type,
            reason: "Figma styles cannot alias another style; only raw values are importable",
        });
        return;
    }

    if (token.type === "typography") {
        const typography = toFigmaTypography(token.value);
        if (typography === undefined) {
            plan.warnings.push(`${dotted}: typography value cannot be read.`);
            return;
        }

        plan.textStyles.push({ path: dotted, name, description: token.description, typography });
        return;
    }

    const effects = toFigmaShadow(token.value);
    if (effects === undefined) {
        plan.warnings.push(`${dotted}: shadow value cannot be read.`);
        return;
    }

    plan.effectStyles.push({ path: dotted, name, description: token.description, effects });
}

function orderVariables(plan: TokenImportPlan, variables: PlannedVariable[]): PlannedVariable[] {
    const { ordered, cycles } = orderByDependency(
        variables,
        (variable) => variable.path,
        (variable) => [...variable.valuesByMode.values()]
            .filter((value) => value.kind === "alias")
            .map((value) => (value as { path: string }).path),
    );

    for (const cycle of cycles) {
        for (const path of cycle.paths) {
            plan.skipped.push({
                path,
                type: "alias",
                reason: "token takes part in a reference cycle",
            });
        }
    }

    return ordered;
}

/**
 * Reports aliases whose target is absent from the plan.
 *
 * The usual cause is a chained skip: a semantic token referencing a primitive
 * of an unsupported type. Reporting it keeps the loss count honest.
 */
function reportUnresolvedAliases(
    plan: TokenImportPlan,
    variablesByPath: Map<string, PlannedVariable>,
): void {
    const resolvable = new Set(variablesByPath.keys());
    const unresolved: PlannedVariable[] = [];

    for (const variable of plan.variables) {
        const missing = [...variable.valuesByMode.values()]
            .filter((value) => value.kind === "alias")
            .map((value) => (value as { path: string }).path)
            .filter((path) => !resolvable.has(path));

        if (missing.length > 0) {
            unresolved.push(variable);
            plan.skipped.push({
                path: variable.path,
                type: "alias",
                reason: `alias target ${missing[0]!} is not importable`,
            });
        }
    }

    const dropped = new Set(unresolved.map((variable) => variable.path));
    plan.variables = plan.variables.filter((variable) => !dropped.has(variable.path));
}

function registerMode(plan: TokenImportPlan, collection: string, modeName: string): void {
    const modes = plan.collections.get(collection) ?? [];
    if (!modes.includes(modeName)) {
        modes.push(modeName);
    }

    plan.collections.set(collection, modes);
}

/** Figma scopes by primitive dimension group, keeping variables usable in the editor. */
const SCOPE_BY_GROUP: Record<string, VariableScope> = {
    space: "GAP",
    spacing: "GAP",
    radius: "CORNER_RADIUS",
    size: "WIDTH_HEIGHT",
    "border-width": "STROKE_FLOAT",
    "font-size": "FONT_SIZE",
    "letter-spacing": "LETTER_SPACING",
};

function toScopes(token: FlatToken): VariableScope[] {
    if (token.type === "color") {
        return [];
    }

    if (token.type === "number") {
        // The exporter derives `number` from the OPACITY scope, so opacity
        // tokens must carry it or they come back as dimensions.
        return isOpacityToken(token) ? ["OPACITY"] : [];
    }

    const group = token.path[2] ?? "";
    for (const [prefix, scope] of Object.entries(SCOPE_BY_GROUP)) {
        if (group.startsWith(prefix)) {
            return [scope];
        }
    }

    return [];
}

function isOpacityToken(token: FlatToken): boolean {
    return token.path.some((segment) => segment.includes("opacity"));
}

/** Derives a Figma mode name from a theme file name, inverting `slugifyFileName`. */
export function toModeName(fileName: string): string {
    const match = /^tokens\.([^.]+)\.json$/i.exec(fileName.trim());
    if (match === null) {
        return BASE_MODE_NAME;
    }

    return match[1]!
        .split("-")
        .filter((part) => part !== "")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

/**
 * Walks a DTCG document into a flat token list.
 *
 * Group-level `$type` is inherited, and alias tokens usually carry no type at
 * all, so the effective type is resolved during the walk.
 */
function flattenTokens(document: unknown): FlatToken[] {
    const tokens: FlatToken[] = [];

    const walk = (node: unknown, path: string[], inheritedType: string): void => {
        if (typeof node !== "object" || node === null || Array.isArray(node)) {
            return;
        }

        const record = node as Record<string, unknown>;
        const type = typeof record["$type"] === "string" ? record["$type"] : inheritedType;

        if ("$value" in record) {
            tokens.push({
                path,
                type,
                value: record["$value"],
                description: typeof record["$description"] === "string" ? record["$description"] : "",
            });
            return;
        }

        for (const [key, child] of Object.entries(record)) {
            if (key.startsWith("$")) {
                continue;
            }

            walk(child, [...path, key], type);
        }
    };

    walk(document, [], "");
    return resolveAliasTypes(tokens);
}

/**
 * Fills in the type of alias tokens by following their reference chain.
 *
 * DTCG lets an alias omit `$type` and inherit it from its target. Every
 * `semantic` and `component` token in a layered set is such an alias, so
 * without this step the whole upper structure would look untyped and be
 * dropped as unsupported.
 */
function resolveAliasTypes(tokens: FlatToken[]): FlatToken[] {
    const byPath = new Map(tokens.map((token) => [token.path.join("."), token]));

    const resolve = (token: FlatToken, seen: Set<string>): string => {
        if (token.type !== "") {
            return token.type;
        }

        const reference = toReferencePath(token.value);
        if (reference === undefined || seen.has(reference)) {
            return "";
        }

        const target = byPath.get(reference);
        if (target === undefined) {
            return "";
        }

        seen.add(reference);
        return resolve(target, seen);
    };

    return tokens.map((token) => (
        token.type === "" ? { ...token, type: resolve(token, new Set()) } : token
    ));
}
