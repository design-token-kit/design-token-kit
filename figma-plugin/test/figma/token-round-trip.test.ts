/**
 * Round-trip test: DTCG -> Figma -> DTCG.
 *
 * This is the executable specification of what Figma can and cannot express.
 * The loss manifest below is hard-coded rather than derived, so that a change in
 * either direction fails loudly and forces the designer documentation to be
 * updated alongside it.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { createFigmaVariablesMock } from "./figmaVariablesMock";
import { loadPluginContext } from "./loadPluginContext";

const currentDir = dirname(fileURLToPath(import.meta.url));
const playgroundDir = resolve(currentDir, "../../../examples/playground");

/** Token types Figma represents. Everything else is expected to be lost. */
const PRESERVED_TYPES = new Set(["color", "dimension", "number", "typography", "shadow"]);

/**
 * Types Figma stores as styles rather than variables.
 *
 * Styles hold raw values only: a style cannot alias another style, so a
 * reference to one cannot survive the round trip.
 */
const STYLE_TYPES = new Set(["typography", "shadow"]);

/** Types with no Figma representation at all. Every such token is lost. */
const UNREPRESENTABLE_TYPES = new Set([
    "fontFamily",
    "fontWeight",
    "duration",
    "cubicBezier",
    "strokeStyle",
    "border",
    "transition",
    "gradient",
]);

/** Colour components are stored as 0..1 floats, so exact equality is not reachable. */
const COLOR_TOLERANCE = 1e-3;

interface FlatToken {
    path: string;
    type: string;
    value: unknown;
}

function readTokens(fileName: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(playgroundDir, fileName), "utf8"));
}

function flatten(document: unknown): FlatToken[] {
    const tokens: FlatToken[] = [];

    const walk = (node: unknown, path: string[], inheritedType: string): void => {
        if (typeof node !== "object" || node === null || Array.isArray(node)) {
            return;
        }

        const record = node as Record<string, unknown>;
        const type = typeof record["$type"] === "string" ? record["$type"] : inheritedType;

        if ("$value" in record) {
            tokens.push({ path: path.join("."), type, value: record["$value"] });
            return;
        }

        for (const [key, child] of Object.entries(record)) {
            if (!key.startsWith("$")) {
                walk(child, [...path, key], type);
            }
        }
    };

    walk(document, [], "");
    return tokens;
}

/** Resolves alias types the way the importer does, so both sides agree on a token's type. */
function withResolvedTypes(tokens: FlatToken[]): FlatToken[] {
    const byPath = new Map(tokens.map((token) => [token.path, token]));

    const resolve = (token: FlatToken, seen: Set<string>): string => {
        if (token.type !== "") {
            return token.type;
        }

        const reference = typeof token.value === "string"
            ? /^\{([^}]+)\}$/.exec(token.value.trim())?.[1]
            : undefined;

        if (reference === undefined || seen.has(reference)) {
            return "";
        }

        seen.add(reference);
        const target = byPath.get(reference);
        return target === undefined ? "" : resolve(target, seen);
    };

    return tokens.map((token) => ({ ...token, type: resolve(token, new Set()) }));
}

interface ExportedFiles {
    [fileName: string]: Record<string, unknown>;
}

describe("DTCG round trip through Figma", () => {
    let exported: ExportedFiles;
    let sourceTokens: FlatToken[];

    beforeAll(async () => {
        const mock = createFigmaVariablesMock();
        const context = loadPluginContext({ figma: mock.figma });

        await context.sendMessage({
            type: "IMPORT_TOKENS",
            strategy: "merge",
            files: [
                { fileName: "tokens.json", content: readFileSync(resolve(playgroundDir, "tokens.json"), "utf8") },
                {
                    fileName: "tokens.dark.json",
                    content: readFileSync(resolve(playgroundDir, "tokens.dark.json"), "utf8"),
                },
            ],
        } as never);

        const imported = context.postedMessages.find((message) => message.type === "TOKENS_IMPORTED");
        expect(imported, "import must succeed").toBeDefined();

        await context.sendMessage({ type: "EXPORT_TOKENS_DTCG" } as never);

        const exportMessage = context.postedMessages.find((message) => message.type === "TOKENS_EXPORTED");
        expect(exportMessage, "export must succeed").toBeDefined();

        const payload = exportMessage!.payload as { files: Array<{ fileName: string; content: string }> };
        exported = {};
        for (const file of payload.files) {
            exported[file.fileName] = JSON.parse(file.content);
        }

        sourceTokens = withResolvedTypes(flatten(readTokens("tokens.json")));
    });

    it("produces the same file set the source set uses", () => {
        expect(Object.keys(exported).sort()).toEqual(["tokens.dark.json", "tokens.json"]);
    });

    it("preserves the layered alias structure instead of resolving it to raw values", () => {
        const tokens = flatten(exported["tokens.json"]!);
        const byPath = new Map(tokens.map((token) => [token.path, token]));

        expect(byPath.get("semantic.color.action-primary")?.value)
            .toBe("{primitive.color.brand-500}");
        expect(byPath.get("component.button.primary.background")?.value)
            .toBe("{semantic.color.action-primary}");
    });

    it("preserves every colour, dimension and number token", () => {
        const exportedPaths = new Set(flatten(exported["tokens.json"]!).map((token) => token.path));

        const missing = sourceTokens
            .filter((token) => ["color", "dimension", "number"].includes(token.type))
            .map((token) => token.path)
            .filter((path) => !exportedPaths.has(path));

        expect(missing).toEqual([]);
    });

    it("preserves colour components within float tolerance", () => {
        const tokens = flatten(exported["tokens.json"]!);
        const byPath = new Map(tokens.map((token) => [token.path, token]));

        const source = sourceTokens.find((token) => token.path === "primitive.color.brand-500")!;
        const result = byPath.get("primitive.color.brand-500")!;

        const sourceComponents = (source.value as { components: number[] }).components;
        const resultComponents = (result.value as { components: number[] }).components;

        for (const [index, component] of sourceComponents.entries()) {
            expect(Math.abs(component - resultComponents[index]!)).toBeLessThan(COLOR_TOLERANCE);
        }
    });

    it("drops the hex fallback that Figma does not store", () => {
        const tokens = flatten(exported["tokens.json"]!);
        const brand = tokens.find((token) => token.path === "primitive.color.brand-500")!;

        expect(brand.value).not.toHaveProperty("hex");
    });

    it("keeps the dark theme as a sparse override of primitives only", () => {
        const darkPaths = flatten(exported["tokens.dark.json"]!).map((token) => token.path);

        expect(darkPaths.length).toBeGreaterThan(0);
        expect(darkPaths.every((path) => path.startsWith("primitive."))).toBe(true);
    });

    it("loses every token type Figma has no representation for", () => {
        const exportedPaths = new Set(flatten(exported["tokens.json"]!).map((token) => token.path));

        const survivors = sourceTokens
            .filter((token) => UNREPRESENTABLE_TYPES.has(token.type))
            .map((token) => token.path)
            .filter((path) => exportedPaths.has(path));

        expect(survivors).toEqual([]);
    });

    it("keeps primitive styles but loses references to them", () => {
        const exportedPaths = new Set(flatten(exported["tokens.json"]!).map((token) => token.path));

        // Figma stores typography and shadow as styles, and a style cannot alias
        // another style. Primitive style tokens hold raw values and survive;
        // semantic and component tokens referencing them cannot be expressed.
        const styleTokens = sourceTokens.filter((token) => STYLE_TYPES.has(token.type));
        const primitives = styleTokens.filter((token) => token.path.startsWith("primitive."));
        const references = styleTokens.filter((token) => !token.path.startsWith("primitive."));

        expect(primitives.length).toBeGreaterThan(0);
        expect(primitives.every((token) => exportedPaths.has(token.path))).toBe(true);

        expect(references.length).toBeGreaterThan(0);
        expect(references.every((token) => !exportedPaths.has(token.path))).toBe(true);
    });

    it("keeps every surviving token within the representable types", () => {
        const exportedTypes = new Set(
            withResolvedTypes(flatten(exported["tokens.json"]!)).map((token) => token.type),
        );

        for (const type of exportedTypes) {
            expect(PRESERVED_TYPES.has(type), `unexpected exported type "${type}"`).toBe(true);
        }
    });

    it("reports every skipped token with a reason", () => {
        const mock = createFigmaVariablesMock();
        const context = loadPluginContext({ figma: mock.figma });

        return context
            .sendMessage({
                type: "IMPORT_TOKENS",
                strategy: "merge",
                files: [
                    {
                        fileName: "tokens.json",
                        content: readFileSync(resolve(playgroundDir, "tokens.json"), "utf8"),
                    },
                ],
            } as never)
            .then(() => {
                const imported = context.postedMessages.find((m) => m.type === "TOKENS_IMPORTED")!;
                const payload = imported.payload as {
                    skipped: Array<{ path: string; type: string; reason: string }>;
                };

                expect(payload.skipped.length).toBeGreaterThan(0);
                for (const entry of payload.skipped) {
                    expect(entry.reason).not.toBe("");
                }
            });
    });
});
