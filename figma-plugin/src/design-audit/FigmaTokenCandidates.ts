import { formatUsageValue } from "@design-token-kit/core/core/audit/usage/TokenUsageAudit";
import type { TokenCandidate, UsageProperty, UsageValue } from "@design-token-kit/core/core/audit/usage/UsageSample";
import { toTokenType } from "#/figma-plugin/token-export/TokenExporter";
import { declaredTokenLayer } from "#/figma-plugin/token-export/TokenNameMapper";

const MAX_ALIAS_DEPTH = 16;

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

/**
 * Reads the tokens of the open file that a hard-coded value could be replaced
 * with: local colour and dimension variables, solid paint styles and text
 * styles.
 *
 * A variable is a candidate for the properties its scopes allow, with its
 * value in every mode of its collection, aliases resolved. A paint style is a
 * candidate for fills and strokes, a text style for font sizes.
 */
export async function readTokenCandidates(): Promise<TokenCandidate[]> {
    const [colors, floats, paintStyles, textStyles] = await Promise.all([
        figma.variables.getLocalVariablesAsync("COLOR"),
        figma.variables.getLocalVariablesAsync("FLOAT"),
        figma.getLocalPaintStylesAsync(),
        figma.getLocalTextStylesAsync(),
    ]);
    const resolver = new VariableResolver();
    const candidates: TokenCandidate[] = [];

    for (const variable of [...colors, ...floats.filter((entry) => toTokenType(entry) === "dimension")]) {
        const properties = scopedProperties(variable);
        if (properties.length === 0) continue;
        for (const value of await resolver.valuesOf(variable)) {
            candidates.push({ kind: "variable", name: variable.name, layer: declaredTokenLayer(variable.name), value, properties });
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
        const key = `${candidate.kind}:${candidate.name}:${formatUsageValue(candidate.value)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Resolves variable values through their aliases. An alias into another
 * collection takes that collection's default mode.
 */
class VariableResolver {
    readonly #variables = new Map<string, Promise<Variable | null>>();
    readonly #collections = new Map<string, Promise<VariableCollection | null>>();

    async valuesOf(variable: Variable): Promise<UsageValue[]> {
        const collection = await this.#collection(variable.variableCollectionId);
        const modeIds = collection?.modes.map((mode) => mode.modeId) ?? Object.keys(variable.valuesByMode);
        const values = await Promise.all(modeIds.map((modeId) => this.#resolve(variable, modeId, 0)));
        return values.filter((value): value is UsageValue => value !== undefined);
    }

    async #resolve(variable: Variable, modeId: string, depth: number): Promise<UsageValue | undefined> {
        const value = variable.valuesByMode[modeId];
        if (isAlias(value)) {
            const target = depth < MAX_ALIAS_DEPTH ? await this.#variable(value.id) : null;
            if (target === null) return undefined;
            const targetMode = target.variableCollectionId === variable.variableCollectionId
                ? modeId
                : (await this.#collection(target.variableCollectionId))?.defaultModeId;
            return targetMode === undefined ? undefined : this.#resolve(target, targetMode, depth + 1);
        }
        if (typeof value === "number") {
            return { type: "dimension", px: value };
        }
        if (typeof value === "object" && value !== null && "r" in value) {
            return { type: "color", color: { red: value.r, green: value.g, blue: value.b, alpha: "a" in value ? value.a : 1 } };
        }
        return undefined;
    }

    #variable(id: string): Promise<Variable | null> {
        let found = this.#variables.get(id);
        if (found === undefined) {
            found = figma.variables.getVariableByIdAsync(id);
            this.#variables.set(id, found);
        }
        return found;
    }

    #collection(id: string): Promise<VariableCollection | null> {
        let found = this.#collections.get(id);
        if (found === undefined) {
            found = figma.variables.getVariableCollectionByIdAsync(id);
            this.#collections.set(id, found);
        }
        return found;
    }
}

function isAlias(value: VariableValue | undefined): value is VariableAlias {
    return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}
