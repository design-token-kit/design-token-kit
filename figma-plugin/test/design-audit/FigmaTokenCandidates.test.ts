import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatUsageValue } from "@design-token-kit/core/core/audit/usage/TokenUsageAudit";
import { readTokenCandidates } from "#/figma-plugin/design-audit/FigmaTokenCandidates";
import { solid } from "./figmaNodes";

const LIGHT = "mode:light";
const DARK = "mode:dark";

function variable(id: string, name: string, resolvedType: "COLOR" | "FLOAT", scopes: string[], valuesByMode: Record<string, unknown>, collection = "themes") {
    return { id, name, resolvedType, scopes, valuesByMode, variableCollectionId: collection, description: "" };
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
const VARIABLES = [BLUE, ACCENT, EFFECT, SPACE, OPACITY];

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

    it("reads variables in every mode for the properties their scopes allow, and paint and text styles", async () => {
        expect((await readTokenCandidates()).map(summary)).toEqual([
            ["variable", "primitive/blue/500", "primitive", "#2563eb", "fill,stroke"],
            ["variable", "semantic/accent", "semantic", "#2563eb", "fill"],
            ["variable", "semantic/accent", "semantic", "#93c5fd", "fill"],
            ["variable", "spacing/4", "-", "16px", "gap,padding"],
            ["style", "Brand", "-", "#2563eb", "fill,stroke"],
            ["style", "Body/M", "-", "16px", "font-size"],
        ]);
    });
});
