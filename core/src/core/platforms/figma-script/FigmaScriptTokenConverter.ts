import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { FIGMA_SCRIPT_RUNTIME } from "#/core/platforms/figma-script/FigmaScriptRuntime";
import {
    FigmaScriptValueConverter,
    type FigmaScriptShadow,
    type FigmaScriptTypography,
} from "#/core/platforms/figma-script/FigmaScriptValueConverter";
import type { TokenConverter } from "#/core/platforms/TokenConverter";

/**
 * Converts DTCG token documents to a script that builds them in Figma.
 *
 * @remarks
 * The Figma Plugin API runs only inside the editor, so tokens cannot be written
 * from outside. This converter emits a self-contained script instead: paste it
 * into a plugin that evaluates code, such as Scripter, and it creates the
 * variable collections, modes, variables and styles the tokens describe.
 *
 * Each token layer becomes a collection, and each theme becomes a mode.
 * References become Figma variable aliases rather than copied values, so the
 * layering survives. Figma represents five of the thirteen DTCG types; the rest
 * are listed in the script header and reported when it runs.
 */
export class FigmaScriptTokenConverter implements TokenConverter {
    readonly #values = new FigmaScriptValueConverter();

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        const plan = this.#buildPlan(list);
        return renderScript(plan, list.base.source ?? "stdin");
    }

    #buildPlan(list: DtcgList): ScriptPlan {
        const plan: ScriptPlan = {
            collections: new Map(),
            variables: new Map(),
            textStyles: [],
            effectStyles: [],
            skipped: [],
        };

        this.#collect(plan, list.base, BASE_MODE, true);
        for (const [themeName, theme] of list.themes) {
            this.#collect(plan, theme, toModeName(themeName), false);
        }

        return {
            ...plan,
            variables: orderByAlias(plan),
        };
    }

    /**
     * Walks one document, adding its tokens to the plan under the given mode.
     */
    #collect(plan: ScriptPlan, doc: Dtcg, mode: string, isBase: boolean): void {
        const walk = (group: Dtcg | TokenGroup, path: string[]): void => {
            for (const [key, child] of group.entries()) {
                const childPath = [...path, key];

                if (child instanceof TokenGroup) {
                    walk(child, childPath);
                } else if (child instanceof TokenNode) {
                    this.#addToken(plan, child, childPath, mode, isBase);
                }
            }
        };

        walk(doc, []);
    }

    #addToken(
        plan: ScriptPlan,
        node: TokenNode<unknown>,
        path: string[],
        mode: string,
        isBase: boolean,
    ): void {
        const dotted = path.join(".");
        const value = node.value;

        // Report an unrepresentable type before naming: a correct path carrying
        // such a type would otherwise be blamed on its name.
        const type = node.type;
        if (type !== undefined && UNSUPPORTED_REASONS[type] !== undefined) {
            this.#skip(plan, dotted, type, UNSUPPORTED_REASONS[type]!, isBase);
            return;
        }

        const name = toFigmaName(path);
        if (name === undefined) {
            this.#skip(plan, dotted, "naming", NAMING_REASON, isBase);
            return;
        }

        // References first: an alias must become a Figma link, not a copy.
        if (value instanceof TokenReference) {
            this.#addVariable(plan, {
                path: dotted,
                name,
                description: node.description,
                value: { alias: value.path.toString() },
                mode,
                isBase,
            });
            return;
        }

        if (value instanceof ColorValue) {
            this.#addVariable(plan, {
                path: dotted,
                name,
                description: node.description,
                value: { value: this.#values.convertColor(value) },
                resolvedType: "COLOR",
                mode,
                isBase,
            });
            return;
        }

        if (value instanceof DimensionValue) {
            this.#addVariable(plan, {
                path: dotted,
                name,
                description: node.description,
                value: { value: this.#values.convertDimension(value) },
                resolvedType: "FLOAT",
                scopes: toDimensionScopes(path),
                mode,
                isBase,
            });
            return;
        }

        if (typeof value === "number") {
            this.#addVariable(plan, {
                path: dotted,
                name,
                description: node.description,
                value: { value },
                resolvedType: "FLOAT",
                scopes: isOpacity(path) ? ["OPACITY"] : [],
                mode,
                isBase,
            });
            return;
        }

        this.#addStyle(plan, node, dotted, name, isBase);
    }

    /**
     * Adds a typography or shadow token as a style, or records why it cannot be one.
     */
    #addStyle(
        plan: ScriptPlan,
        node: TokenNode<unknown>,
        dotted: string,
        name: string,
        isBase: boolean,
    ): void {
        const value = node.value;

        // Styles carry no modes, so a theme cannot override one.
        if (!isBase) {
            return;
        }

        if (value instanceof TypographyValue) {
            const typography = this.#values.convertTypography(value);
            if (typography === undefined) {
                this.#skip(plan, dotted, "typography", STYLE_REFERENCE_REASON, isBase);
                return;
            }

            plan.textStyles.push({ path: dotted, name, description: node.description, ...typography });
            return;
        }

        const shadow = toShadowLayers(value);
        if (shadow !== undefined) {
            const effects = shadow.map((layer) => this.#values.convertShadow(layer));
            if (effects.some((effect) => effect === undefined)) {
                this.#skip(plan, dotted, "shadow", STYLE_REFERENCE_REASON, isBase);
                return;
            }

            plan.effectStyles.push({
                path: dotted,
                name,
                description: node.description,
                effects: effects as FigmaScriptShadow[],
            });
            return;
        }

        const type = node.type ?? "unknown";
        this.#skip(plan, dotted, type, UNSUPPORTED_REASONS[type] ?? defaultReason(type), isBase);
    }

    #addVariable(plan: ScriptPlan, request: VariableRequest): void {
        const layer = request.path.split(".")[0] ?? "";
        const collection = COLLECTION_BY_LAYER[layer];

        if (collection === undefined) {
            this.#skip(plan, request.path, "naming", NAMING_REASON, request.isBase);
            return;
        }

        registerMode(plan, collection, request.mode);

        const existing = plan.variables.get(request.path);
        if (existing !== undefined) {
            existing.values[request.mode] = request.value;
            return;
        }

        plan.variables.set(request.path, {
            path: request.path,
            name: request.name,
            collection,
            // An alias inherits its type from the target, resolved once the plan is complete.
            resolvedType: request.resolvedType,
            scopes: request.scopes ?? [],
            description: request.description ?? "",
            values: { [request.mode]: request.value },
        });
    }

    #skip(plan: ScriptPlan, path: string, type: string, reason: string, isBase: boolean): void {
        if (isBase) {
            plan.skipped.push({ path, type, reason });
        }
    }
}

/**
 * Figma mode holding the base document.
 *
 * The export path reads a collection's default mode as the base token file
 * regardless of its name, so this label is for the designer reading it in
 * Figma. It pairs with the usual `Dark` theme.
 */
const BASE_MODE = "Light";

/**
 * Figma variable collection per token layer.
 */
const COLLECTION_BY_LAYER: Record<string, string> = {
    primitive: "Primitive",
    semantic: "Semantic",
    component: "Component",
};

/**
 * Figma scopes by dimension group, keeping variables usable in the editor.
 */
const SCOPE_BY_GROUP: Record<string, string> = {
    space: "GAP",
    spacing: "GAP",
    radius: "CORNER_RADIUS",
    size: "WIDTH_HEIGHT",
    "border-width": "STROKE_FLOAT",
    "font-size": "FONT_SIZE",
    "letter-spacing": "LETTER_SPACING",
};

/**
 * Why a type has no Figma representation, shown in the script header.
 */
const UNSUPPORTED_REASONS: Record<string, string> = {
    fontFamily: "Figma has no font family variable; the family lives inside a text style",
    fontWeight: "Figma has no font weight variable; the weight lives inside a text style",
    duration: "Figma has no duration variable type",
    cubicBezier: "Figma has no easing variable type",
    strokeStyle: "Figma has no stroke style variable type",
    border: "Figma has no composite border variable; use separate width and color tokens",
    transition: "Figma has no transition variable type",
    gradient: "Figma has no gradient variable type; use a paint style instead",
};

const STYLE_REFERENCE_REASON =
    "Figma styles hold values and cannot alias another style";

const NAMING_REASON =
    "token path needs a primitive, semantic or component layer and at least three segments";

const CYCLE_REASON = "token takes part in a reference cycle";

function defaultReason(type: string): string {
    return `Figma has no representation for the "${type}" token type`;
}

interface ScriptPlan {
    /**
     * Collection name to its mode names, base mode first.
     */
    collections: Map<string, string[]>;
    variables: Map<string, PlannedVariable>;
    textStyles: PlannedTextStyle[];
    effectStyles: PlannedEffectStyle[];
    skipped: SkippedToken[];
}

interface PlannedVariable {
    path: string;
    name: string;
    collection: string;
    resolvedType: "COLOR" | "FLOAT" | undefined;
    scopes: string[];
    description: string;
    values: Record<string, PlannedValue>;
}

type PlannedValue =
    | { value: unknown; alias?: undefined }
    | { alias: string; value?: undefined };

interface PlannedTextStyle extends FigmaScriptTypography {
    path: string;
    name: string;
    description: string | undefined;
}

interface PlannedEffectStyle {
    path: string;
    name: string;
    description: string | undefined;
    effects: FigmaScriptShadow[];
}

interface SkippedToken {
    path: string;
    type: string;
    reason: string;
}

interface VariableRequest {
    path: string;
    name: string;
    description: string | undefined;
    value: PlannedValue;
    resolvedType?: "COLOR" | "FLOAT";
    scopes?: string[];
    mode: string;
    isBase: boolean;
}

/**
 * Orders variables so an alias target precedes the variable pointing at it.
 *
 * A generated script runs top to bottom and a Figma alias needs an existing
 * target, so creation order matters. Resolving the order also settles each
 * alias's type, which DTCG lets a token inherit from its target.
 */
function orderByAlias(plan: ScriptPlan): Map<string, PlannedVariable> {
    const pending = new Map<string, Set<string>>();
    const dependents = new Map<string, string[]>();

    for (const variable of plan.variables.values()) {
        const targets = aliasTargets(variable).filter((target) => plan.variables.has(target));
        pending.set(variable.path, new Set(targets));

        for (const target of targets) {
            dependents.set(target, [...dependents.get(target) ?? [], variable.path]);
        }
    }

    const ready = [...plan.variables.keys()].filter((path) => pending.get(path)!.size === 0);
    const ordered = new Map<string, PlannedVariable>();

    while (ready.length > 0) {
        const path = ready.shift()!;
        const variable = plan.variables.get(path)!;
        ordered.set(path, withResolvedType(variable, ordered, plan));

        for (const dependent of dependents.get(path) ?? []) {
            const remaining = pending.get(dependent)!;
            remaining.delete(path);
            if (remaining.size === 0) {
                ready.push(dependent);
            }
        }
    }

    for (const path of plan.variables.keys()) {
        if (!ordered.has(path)) {
            plan.skipped.push({ path, type: "alias", reason: CYCLE_REASON });
        }
    }

    dropUnresolvable(ordered, plan);
    return ordered;
}

/**
 * Gives an alias variable the type of its target.
 *
 * A DTCG alias may omit `$type`, while a Figma variable must state one at
 * creation. The target is already ordered before its referent, so its type is
 * known by the time it is needed.
 */
function withResolvedType(
    variable: PlannedVariable,
    ordered: Map<string, PlannedVariable>,
    plan: ScriptPlan,
): PlannedVariable {
    if (variable.resolvedType !== undefined) {
        return variable;
    }

    for (const target of aliasTargets(variable)) {
        const resolved = ordered.get(target)?.resolvedType ?? plan.variables.get(target)?.resolvedType;
        if (resolved !== undefined) {
            return { ...variable, resolvedType: resolved };
        }
    }

    return variable;
}

/**
 * Removes variables whose alias target is absent from the plan.
 *
 * The usual cause is a chained skip: a token referencing one of the types
 * Figma cannot represent. Reporting it keeps the loss count honest.
 */
function dropUnresolvable(ordered: Map<string, PlannedVariable>, plan: ScriptPlan): void {
    for (;;) {
        const unresolved = [...ordered.values()].filter((variable) => (
            variable.resolvedType === undefined
            || aliasTargets(variable).some((target) => !ordered.has(target))
        ));

        if (unresolved.length === 0) {
            return;
        }

        for (const variable of unresolved) {
            const missing = aliasTargets(variable).find((target) => !ordered.has(target));
            ordered.delete(variable.path);
            plan.skipped.push({
                path: variable.path,
                type: "alias",
                reason: missing === undefined
                    ? "alias target has no Figma type"
                    : `alias target ${missing} is not importable`,
            });
        }
    }
}

function aliasTargets(variable: PlannedVariable): string[] {
    return Object.values(variable.values)
        .map((value) => value.alias)
        .filter((alias): alias is string => alias !== undefined);
}

function registerMode(plan: ScriptPlan, collection: string, mode: string): void {
    const modes = plan.collections.get(collection) ?? [];
    if (!modes.includes(mode)) {
        modes.push(mode);
    }

    plan.collections.set(collection, modes);
}

/**
 * Converts a token path to a Figma entity name.
 *
 * The Figma export path reads a leading layer as an explicit token path, so
 * keeping the layer in the name lets a token survive a round trip. Segments
 * must already be lowercase and hyphenated for the same reason.
 */
function toFigmaName(path: string[]): string | undefined {
    if (path.length < MIN_NAME_SEGMENTS || COLLECTION_BY_LAYER[path[0]!] === undefined) {
        return undefined;
    }

    return path.every(isRoundTripSafe) ? path.join("/") : undefined;
}

const MIN_NAME_SEGMENTS = 3;

/**
 * Turns a theme name into a Figma mode name.
 *
 * Theme names arrive slugified from the file name, while a Figma mode is a
 * label a designer reads, so `brand-a` becomes `Brand A`.
 */
function toModeName(theme: string): string {
    return theme
        .split(/[-_\s]+/)
        .filter((part) => part !== "")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ") || theme;
}

function isRoundTripSafe(segment: string): boolean {
    return segment !== "" && slugify(segment) === segment;
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function toDimensionScopes(path: string[]): string[] {
    const group = path[2] ?? "";

    for (const [prefix, scope] of Object.entries(SCOPE_BY_GROUP)) {
        if (group.startsWith(prefix)) {
            return [scope];
        }
    }

    return [];
}

function isOpacity(path: string[]): boolean {
    return path.some((segment) => segment.includes("opacity"));
}

/**
 * Reads a shadow value, which DTCG allows as one layer or a list of them.
 */
function toShadowLayers(value: unknown): ShadowLayer[] | undefined {
    if (value instanceof ShadowLayer) {
        return [value];
    }

    if (!Array.isArray(value) || value.length === 0) {
        return undefined;
    }

    return value.every((layer) => layer instanceof ShadowLayer)
        ? value as ShadowLayer[]
        : undefined;
}

function renderScript(plan: ScriptPlan, source: string): string {
    const collections = [...plan.collections].map(([name, modes]) => ({ name, modes }));

    return [
        renderHeader(plan, source),
        "",
        `const COLLECTIONS = ${literal(collections)};`,
        "",
        `const VARIABLES = ${literal([...plan.variables.values()])};`,
        "",
        `const TEXT_STYLES = ${literal(plan.textStyles)};`,
        "",
        `const EFFECT_STYLES = ${literal(plan.effectStyles)};`,
        "",
        `const SKIPPED = ${literal(plan.skipped)};`,
        "",
        FIGMA_SCRIPT_RUNTIME,
        "",
    ].join("\n");
}

function renderHeader(plan: ScriptPlan, source: string): string {
    const lines = [
        "/**",
        ` * Design tokens from \`${source}\` as Figma variables and styles.`,
        " *",
        " * Run this in a Figma plugin that evaluates code, such as Scripter.",
        " * Running it again updates the entities it created rather than duplicating them.",
        " *",
        ` * Collections: ${[...plan.collections.keys()].join(", ") || "none"}.`,
        ` * Variables: ${plan.variables.size}.`
        + ` Text styles: ${plan.textStyles.length}.`
        + ` Effect styles: ${plan.effectStyles.length}.`,
    ];

    if (plan.skipped.length > 0) {
        lines.push(" *", ` * Not representable in Figma (${plan.skipped.length} tokens):`);
        for (const group of groupSkipped(plan.skipped)) {
            lines.push(` *   ${group.type} (${group.paths.length}): ${group.reason}`);
        }
    }

    lines.push(" */");
    return lines.join("\n");
}

function groupSkipped(skipped: SkippedToken[]): Array<{ type: string; reason: string; paths: string[] }> {
    const byType = new Map<string, { type: string; reason: string; paths: string[] }>();

    for (const entry of skipped) {
        const group = byType.get(entry.type) ?? { type: entry.type, reason: entry.reason, paths: [] };
        group.paths.push(entry.path);
        byType.set(entry.type, group);
    }

    return [...byType.values()];
}

/**
 * Serialises plan data as a JavaScript literal the script carries inline.
 */
function literal(value: unknown): string {
    return JSON.stringify(value, undefined, 4);
}
