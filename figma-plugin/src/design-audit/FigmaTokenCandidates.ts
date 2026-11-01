import { formatUsageValue } from "@design-token-kit/core/core/audit/usage/TokenUsageAudit";
import type { TokenCandidate, UsageProperty, UsageValue } from "@design-token-kit/core/core/audit/usage/UsageSample";
import { toTokenType } from "#/figma-plugin/token-export/TokenExporter";
import { declaredTokenLayer } from "#/figma-plugin/token-export/TokenNameMapper";

const COLOR_SCOPES: Partial<Record<VariableScope, readonly UsageProperty[]>> = {
    ALL_SCOPES: ["fill", "stroke"],
    ALL_FILLS: ["fill"],
    FRAME_FILL: ["fill"],
    SHAPE_FILL: ["fill"],
    TEXT_FILL: ["fill"],
    STROKE_COLOR: ["stroke"],
};

const DIMENSION_SCOPES: Partial<Record<VariableScope, readonly UsageProperty[]>> = {
    ALL_SCOPES: ["corner-radius", "gap", "padding", "font-size"],
    CORNER_RADIUS: ["corner-radius"],
    // Figma offers "gap" variables for padding as well.
    GAP: ["gap", "padding"],
    FONT_SIZE: ["font-size"],
};

const MAX_ALIAS_DEPTH = 16;

/**
 * Reads the tokens of the open file that a hard-coded value could be replaced
 * with: local colour and dimension variables, solid paint styles and text
 * styles.
 *
 * A variable is a candidate for the properties its scopes allow, with its
 * value resolved for each mode context used by the audited nodes. A paint style
 * is a candidate for fills and strokes, a text style for font sizes.
 */
export async function readTokenCandidates(consumers: readonly SceneNode[]): Promise<TokenCandidate[]> {
    const [colors, floats, paintStyles, textStyles] = await Promise.all([
        figma.variables.getLocalVariablesAsync("COLOR"),
        figma.variables.getLocalVariablesAsync("FLOAT"),
        figma.getLocalPaintStylesAsync(),
        figma.getLocalTextStylesAsync(),
    ]);
    const modeContexts = uniqueModeContexts(consumers);
    const dependencies = new VariableDependencyResolver();
    const candidates: TokenCandidate[] = [];

    for (const variable of [...colors, ...floats.filter((entry) => toTokenType(entry) === "dimension")]) {
        const properties = scopedProperties(variable);
        if (properties.length === 0) continue;
        for (const context of modeContexts) {
            const requiredCollections = await dependencies.forConsumer(variable, context.modes);
            if (requiredCollections === undefined || !hasAllModes(requiredCollections, context.modes)) continue;
            const value = resolveValue(variable, context.consumer);
            if (value === undefined) continue;
            candidates.push({
                kind: "variable",
                name: variable.name,
                layer: declaredTokenLayer(variable.name),
                value,
                properties,
                variableModes: context.modes,
            });
        }
    }
    for (const style of paintStyles) {
        const visible = style.paints.filter((paint) => paint.visible !== false);
        const paint = visible.length === 1 ? visible[0] : undefined;
        if (paint?.type !== "SOLID") continue;
        candidates.push(styleCandidate(style.name, ["fill", "stroke"], {
            type: "color",
            color: { red: paint.color.r, green: paint.color.g, blue: paint.color.b, alpha: paint.opacity ?? 1 },
        }));
    }
    for (const style of textStyles) {
        candidates.push(styleCandidate(style.name, ["font-size"], { type: "dimension", px: style.fontSize }));
    }
    return unique(candidates);
}

function scopedProperties(variable: Variable): UsageProperty[] {
    const scopes = variable.resolvedType === "COLOR" ? COLOR_SCOPES : DIMENSION_SCOPES;
    return [...new Set(variable.scopes.flatMap((scope) => scopes[scope] ?? []))];
}

function styleCandidate(name: string, properties: UsageProperty[], value: UsageValue): TokenCandidate {
    return { kind: "style", name, layer: declaredTokenLayer(name), value, properties };
}

function unique(candidates: TokenCandidate[]): TokenCandidate[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
        const key = `${candidate.kind}:${candidate.name}:${formatUsageValue(candidate.value)}:${modeKey(candidate.variableModes)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

interface ModeContext {
    readonly consumer: SceneNode;
    readonly modes: Readonly<Record<string, string>>;
}

function uniqueModeContexts(consumers: readonly SceneNode[]): ModeContext[] {
    const contexts = new Map<string, ModeContext>();
    for (const consumer of consumers) {
        const modes = resolvedVariableModes(consumer);
        if (modes === undefined) continue;
        const key = modeKey(modes);
        if (!contexts.has(key)) contexts.set(key, { consumer, modes });
    }
    return [...contexts.values()];
}

function resolvedVariableModes(node: SceneNode): Readonly<Record<string, string>> | undefined {
    const modes = "resolvedVariableModes" in node ? node.resolvedVariableModes : undefined;
    return modes === undefined || Object.keys(modes).length === 0 ? undefined : { ...modes };
}

function modeKey(modes: Readonly<Record<string, string>> | undefined): string {
    return modes === undefined ? "" : JSON.stringify(Object.entries(modes).sort(([first], [second]) => first.localeCompare(second)));
}

function resolveValue(variable: Variable, consumer: SceneNode): UsageValue | undefined {
    try {
        return toUsageValue(variable.resolveForConsumer(consumer).value);
    } catch (_error: unknown) {
        return undefined;
    }
}

class VariableDependencyResolver {
    readonly #variables = new Map<string, Promise<Variable | null>>();

    async forConsumer(
        variable: Variable,
        modes: Readonly<Record<string, string>>,
    ): Promise<Set<string> | undefined> {
        return this.#collect(variable, modes, new Set(), 0);
    }

    async #collect(
        variable: Variable,
        modes: Readonly<Record<string, string>>,
        visited: ReadonlySet<string>,
        depth: number,
    ): Promise<Set<string> | undefined> {
        if (depth > MAX_ALIAS_DEPTH || visited.has(variable.id)) return undefined;
        const collections = new Set([variable.variableCollectionId]);
        const modeId = modes[variable.variableCollectionId];
        if (modeId === undefined) return collections;

        const value = variable.valuesByMode[modeId];
        if (!isAlias(value)) return collections;
        const target = await this.#variable(value.id);
        if (target === null) return undefined;
        const targetCollections = await this.#collect(target, modes, new Set([...visited, variable.id]), depth + 1);
        if (targetCollections === undefined) return undefined;
        targetCollections.forEach((collectionId) => collections.add(collectionId));
        return collections;
    }

    #variable(id: string): Promise<Variable | null> {
        let variable = this.#variables.get(id);
        if (variable === undefined) {
            variable = figma.variables.getVariableByIdAsync(id);
            this.#variables.set(id, variable);
        }
        return variable;
    }
}

function hasAllModes(collections: ReadonlySet<string>, modes: Readonly<Record<string, string>>): boolean {
    return [...collections].every((collectionId) => modes[collectionId] !== undefined);
}

function toUsageValue(value: VariableValue): UsageValue | undefined {
    if (typeof value === "number") return { type: "dimension", px: value };
    if (typeof value === "object" && value !== null && "r" in value) {
        return { type: "color", color: { red: value.r, green: value.g, blue: value.b, alpha: "a" in value ? value.a : 1 } };
    }
    return undefined;
}

function isAlias(value: VariableValue | undefined): value is VariableAlias {
    return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}
