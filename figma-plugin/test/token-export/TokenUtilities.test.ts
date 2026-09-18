import { describe, expect, it } from "vitest";
import { TokenConversionService } from "#/figma-plugin/token-export/TokenConversionService";
import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";
import { TokenCounter } from "#/figma-plugin/token-export/TokenCounter";
import { TokenDocumentBuilder } from "#/figma-plugin/token-export/TokenDocumentBuilder";

describe("TokenCounter", () => {
    it("returns empty counts for non-record values", () => {
        const counter = new TokenCounter();

        expect(counter.count(null)).toEqual(counter.empty());
        expect(counter.count("token")).toEqual(counter.empty());
        expect(counter.count(["token"])).toEqual(counter.empty());
    });

    it("counts supported token types in nested documents", () => {
        const counts = new TokenCounter().count({
            primitive: {
                color: { blue: { $type: "color", $value: "#00f" } },
                dimension: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
                number: { opacity: { $type: "number", $value: 0.5 } },
                typography: { body: { $type: "typography", $value: {} } },
                shadow: { card: { $type: "shadow", $value: {} } },
                unknown: { $type: "unknown", $value: "value" },
            },
        });

        expect(counts).toEqual({
            colorTokens: 1,
            dimensionTokens: 1,
            numberTokens: 1,
            typographyTokens: 1,
            shadowTokens: 1,
        });
    });

    it("adds all token counters without mutating the inputs", () => {
        const counter = new TokenCounter();
        const left = { colorTokens: 1, dimensionTokens: 2, numberTokens: 3, typographyTokens: 4, shadowTokens: 5 };
        const right = { colorTokens: 5, dimensionTokens: 4, numberTokens: 3, typographyTokens: 2, shadowTokens: 1 };

        expect(counter.add(left, right)).toEqual({
            colorTokens: 6,
            dimensionTokens: 6,
            numberTokens: 6,
            typographyTokens: 6,
            shadowTokens: 6,
        });
        expect(left).toEqual({ colorTokens: 1, dimensionTokens: 2, numberTokens: 3, typographyTokens: 4, shadowTokens: 5 });
    });
});

describe("TokenDocumentBuilder", () => {
    it("builds nested documents from flat token paths", () => {
        const document = new TokenDocumentBuilder().build([
            { path: ["primitive", "color", "brand"], token: { $type: "color", $value: "#00f" } },
            { path: ["semantic", "color", "action"], token: { $value: "{primitive.color.brand}" } },
        ]);

        expect(document).toEqual({
            primitive: { color: { brand: { $type: "color", $value: "#00f" } } },
            semantic: { color: { action: { $value: "{primitive.color.brand}" } } },
        });
    });

    it("clones the base document and replaces conflicting path segments", () => {
        const baseDocument = {
            existing: { keep: true },
            primitive: "replace-me",
        };

        const document = new TokenDocumentBuilder().buildFrom(baseDocument, [
            { path: ["primitive", "color", "brand"], token: { $value: "#00f" } },
        ]);

        expect(document).toEqual({
            existing: { keep: true },
            primitive: { color: { brand: { $value: "#00f" } } },
        });
        expect(baseDocument).toEqual({ existing: { keep: true }, primitive: "replace-me" });
    });

    it("overwrites an existing token and preserves an empty clone", () => {
        const builder = new TokenDocumentBuilder();
        const baseDocument = { primitive: { color: { brand: { $value: "#000" } } } };

        expect(builder.buildFrom(baseDocument, [])).toEqual(baseDocument);
        expect(builder.buildFrom(baseDocument, [
            { path: ["primitive", "color", "brand"], token: { $value: "#00f" } },
        ])).toEqual({ primitive: { color: { brand: { $value: "#00f" } } } });
    });
});

describe("TokenConversionService", () => {
    it("preserves DTCG files without converting them", () => {
        const file = exportedFile("tokens.json", '{"primitive":{}}', { primitive: {} }, true);

        expect(new TokenConversionService().convert({ files: [file], format: "dtcg" })).toEqual([{
            fileName: file.fileName,
            content: file.content,
            tokens: file.tokens,
            downloadable: file.downloadable,
        }]);
    });

    it("returns no platform files when no downloadable source exists", () => {
        const file = exportedFile("tokens.json", "{}", {}, false);

        expect(new TokenConversionService().convert({ files: [file], format: "css" })).toEqual([]);
    });

    it("converts a base file and a theme to CSS and SCSS outputs", () => {
        const files = [
            exportedFile("tokens.dark.json", tokenDocument("#111111"), {}, true),
            exportedFile("tokens.json", tokenDocument("#ffffff"), {}, true),
        ];
        const service = new TokenConversionService();

        const css = service.convert({ files, format: "css" });
        const scss = service.convert({ files, format: "scss" });

        expect(css).toHaveLength(1);
        expect(css[0]?.fileName).toBe("tokens.css");
        expect(css[0]?.content).toContain("--primitive-color-brand");
        expect(scss.map((file) => file.fileName)).toEqual(["tokens.scss", "tokens.dark.scss"]);
    });

    it("converts platform formats from the first downloadable file when base is absent", () => {
        const file = exportedFile("brand.json", tokenDocument("#ffffff"), {}, true);
        const service = new TokenConversionService();

        expect(service.convert({ files: [file], format: "tailwind-v4" })[0]?.fileName).toBe("tokens.tailwind.css");
        expect(service.convert({ files: [file], format: "android" }).length).toBeGreaterThan(0);
        expect(service.convert({ files: [file], format: "swiftui" })[0]?.fileName).toBe("DesignTokens.swift");
    });
});

function exportedFile(
    fileName: string,
    content: string,
    tokens: Record<string, unknown>,
    downloadable: boolean,
): ExportedTokenFile {
    return { fileName, content, tokens, downloadable, architectureWarnings: [] };
}

function tokenDocument(color: string): string {
    return JSON.stringify({
        primitive: {
            color: {
                brand: {
                    $type: "color",
                    $value: {
                        colorSpace: "srgb",
                        components: hexToComponents(color),
                        alpha: 1,
                    },
                },
            },
        },
    });
}

function hexToComponents(color: string): [number, number, number] {
    const normalized = color.slice(1);
    return [
        Number.parseInt(normalized.slice(0, 2), 16) / 255,
        Number.parseInt(normalized.slice(2, 4), 16) / 255,
        Number.parseInt(normalized.slice(4, 6), 16) / 255,
    ];
}
