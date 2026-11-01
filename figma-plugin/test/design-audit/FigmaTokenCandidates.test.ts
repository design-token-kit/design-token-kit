import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatUsageValue } from "@design-token-kit/core/core/audit/usage/TokenUsageAudit";
import { readTokenCandidates } from "#/figma-plugin/design-audit/FigmaTokenCandidates";
import { solid } from "./figmaNodes";

const LIGHT = "mode:light";
const DARK = "mode:dark";

interface FakeVariable {
    readonly id: string;
    readonly name: string;
    readonly resolvedType: "COLOR" | "FLOAT";
    readonly scopes: string[];
    readonly valuesByMode: Record<string, VariableValue>;
    readonly variableCollectionId: string;
    readonly description: string;
    readonly resolveForConsumer: (consumer: SceneNode) => { value: VariableValue; resolvedType: "COLOR" | "FLOAT" };
}

function variable(
    id: string,
    name: string,
    resolvedType: "COLOR" | "FLOAT",
    scopes: string[],
    valuesByMode: Record<string, VariableValue>,
    collection = "themes",
): FakeVariable {
    const definition = { id, name, resolvedType, scopes, valuesByMode, variableCollectionId: collection, description: "" };
    return {
        ...definition,
        resolveForConsumer: (consumer) => {
            const modeId = consumer.resolvedVariableModes[definition.variableCollectionId];
            const value = definition.valuesByMode[modeId];
            if (value === undefined) throw new Error(`Missing mode ${modeId}`);
            if (isAlias(value)) {
                const target = VARIABLES.find((entry) => entry.id === value.id);
                if (target === undefined) throw new Error(`Missing variable ${value.id}`);
                return target.resolveForConsumer(consumer);
            }
            return { value, resolvedType };
        },
    };
}

function isAlias(value: VariableValue): value is VariableAlias {
    return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}

function rgba(hex: string, a = 1) {
    const value = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    return { r, g, b, a };
}

const COLLECTIONS: Record<string, unknown> = {
    themes: { id: "themes", defaultModeId: LIGHT, modes: [{ modeId: LIGHT, name: "Light" }, { modeId: DARK, name: "Dark" }] },
    palette: { id: "palette", defaultModeId: "mode:value", modes: [{ modeId: "mode:value", name: "Value" }] },
};

const BLUE = variable("var:blue", "primitive/blue/500", "COLOR", ["ALL_SCOPES"], { "mode:value": rgba("#2563eb") }, "palette");
const ACCENT = variable("var:accent", "semantic/accent", "COLOR", ["FRAME_FILL", "SHAPE_FILL"], {
    [LIGHT]: { type: "VARIABLE_ALIAS", id: "var:blue" },
    [DARK]: rgba("#93c5fd"),
});
const EFFECT = variable("var:shadow", "semantic/shadow", "COLOR", ["EFFECT_COLOR"], { [LIGHT]: rgba("#000000", 0.2) });
const SPACE = variable("var:space", "spacing/4", "FLOAT", ["GAP"], { "mode:value": 16 }, "palette");
const OPACITY = variable("var:opacity", "opacity/50", "FLOAT", ["OPACITY"], { "mode:value": 0.5 }, "palette");
const VARIABLES: FakeVariable[] = [BLUE, ACCENT, EFFECT, SPACE, OPACITY];

const LIGHT_CONSUMER = { resolvedVariableModes: { themes: LIGHT, palette: "mode:value" } } as unknown as SceneNode;
const DARK_CONSUMER = { resolvedVariableModes: { themes: DARK, palette: "mode:value" } } as unknown as SceneNode;
const UNKNOWN_CONSUMER = {} as SceneNode;

function summary(candidate: Awaited<ReturnType<typeof readTokenCandidates>>[number]) {
    return [candidate.kind, candidate.name, candidate.layer ?? "-", formatUsageValue(candidate.value), candidate.properties?.join(",")];
}

describe("readTokenCandidates", () => {
    beforeEach(() => {
        vi.stubGlobal("figma", {
            variables: {
                getLocalVariablesAsync: vi.fn(async (type: string) => VARIABLES.filter((entry) => entry.resolvedType === type)),
                getVariableByIdAsync: vi.fn(async (id: string) => VARIABLES.find((entry) => entry.id === id) ?? null),
                getVariableCollectionByIdAsync: vi.fn(async (id: string) => COLLECTIONS[id] ?? null),
            },
            getLocalPaintStylesAsync: vi.fn(async () => [
                { name: "Brand", paints: [solid("#2563eb")] },
                { name: "Overlay", paints: [solid("#000000"), solid("#ffffff")] },
            ]),
            getLocalTextStylesAsync: vi.fn(async () => [{ name: "Body/M", fontSize: 16 }]),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("resolves variables for the effective mode of each consumer and keeps local styles mode-independent", async () => {
        const candidates = await readTokenCandidates([LIGHT_CONSUMER, DARK_CONSUMER]);
        const accentCandidates = candidates.filter((candidate) => candidate.name === "semantic/accent");

        expect(accentCandidates.map((candidate) => [formatUsageValue(candidate.value), candidate.variableModes])).toEqual([
            ["#2563eb", { themes: LIGHT, palette: "mode:value" }],
            ["#93c5fd", { themes: DARK, palette: "mode:value" }],
        ]);
        expect(candidates.filter((candidate) => candidate.name === "Brand").map(summary)).toEqual([
            ["style", "Brand", "-", "#2563eb", "fill,stroke"],
        ]);
    });

    it("does not create variable suggestions when the consumer mode cannot be determined", async () => {
        const candidates = await readTokenCandidates([UNKNOWN_CONSUMER]);

        expect(candidates.filter((candidate) => candidate.kind === "variable")).toEqual([]);
        expect(candidates.filter((candidate) => candidate.kind === "style").map((candidate) => candidate.name)).toEqual(["Brand", "Body/M"]);
    });

    it("does not resolve a cross-collection alias when the target collection mode is missing", async () => {
        const consumer = { resolvedVariableModes: { themes: LIGHT } } as unknown as SceneNode;
        const candidates = await readTokenCandidates([consumer]);

        expect(candidates.filter((candidate) => candidate.kind === "variable")).toEqual([]);
        expect(candidates.filter((candidate) => candidate.kind === "style").map((candidate) => candidate.name)).toEqual(["Brand", "Body/M"]);
    });
});
