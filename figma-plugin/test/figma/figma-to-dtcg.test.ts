import { describe, expect, it } from "vitest";
import { createColorToken, createReferenceToken } from "./fixtures/builders";
import {
    aliasChainVariables,
    bothModes,
    conflictingPathVariables,
    crossCollectionAliasLookupVariables,
    crossCollectionAliasVariables,
    cyclicAliasVariables,
    darkMode,
    lightMode,
    metadataColorVariables,
    multiModeVariables,
    nonColorVariables,
    singleColorVariable,
    twoColorVariables,
    unresolvedAliasVariables,
} from "./fixtures/variable-sets";
import { loadPluginContext, toPlainJson } from "./loadPluginContext";

describe("figma-to-dtcg", () => {
    it("converts direct color values for one selected mode", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                twoColorVariables,
                lightMode,
            ),
        );

        expect(result).toEqual({
            tree: {
                primitive: {
                    color: {
                        red: createColorToken({ r: 1, g: 0, b: 0, a: 1 }),
                        blue: createColorToken({ r: 0, g: 0, b: 1, a: 1 }),
                    },
                },
            },
            convertedColorVariableCount: 2,
            issues: [],
        });
    });

    it("converts color aliases into DTCG references", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                aliasChainVariables,
                lightMode,
            ),
        );

        expect(result.convertedColorVariableCount).toBe(2);
        expect(result.issues).toEqual([]);
        expect(result.tree.semantic.color.link.$value).toBe("{primitive.color.text}");
    });

    it("keeps the first token when path conflicts with a group", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                conflictingPathVariables,
                lightMode,
            ),
        );

        expect(result.convertedColorVariableCount).toBe(1);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe("path-conflict");
        expect(result.tree).toEqual({
            primitive: {
                color: {
                    red: createColorToken({ r: 1, g: 0, b: 0, a: 1 }),
                },
            },
        });
    });

    it("reports a missing value for the selected mode", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                singleColorVariable,
                darkMode,
            ),
        );

        expect(result.convertedColorVariableCount).toBe(0);
        expect(result.tree).toEqual({});
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe("missing-mode-value");
    });

    it("skips non-color variables", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                nonColorVariables,
                lightMode,
            ),
        );

        expect(result).toEqual({
            tree: {},
            convertedColorVariableCount: 0,
            issues: [],
        });
    });

    it("reports an unresolved alias when the target is not converted", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                unresolvedAliasVariables,
                lightMode,
            ),
        );

        expect(result.tree).toEqual({});
        expect(result.convertedColorVariableCount).toBe(0);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toEqual({
            path: "semantic/color/link",
            code: "unresolved-alias",
            message: "Cannot create token at \"semantic/color/link\": alias target \"content/title\" could not be converted.",
        });
    });

    it("keeps cross-collection color aliases as DTCG references", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                crossCollectionAliasVariables,
                lightMode,
                crossCollectionAliasLookupVariables,
            ),
        );

        expect(result).toEqual({
            tree: {
                semantic: {
                    color: {
                        link: createReferenceToken("{primitive.brand.primary}"),
                    },
                },
            },
            convertedColorVariableCount: 1,
            issues: [],
        });
    });

    it("adds hex, description, and figma extensions to direct color tokens", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                metadataColorVariables,
                lightMode,
            ),
        );

        expect(result).toEqual({
            tree: {
                primitive: {
                    color: {
                        brand: createColorToken(
                            { r: 0.145, g: 0.286, b: 0.965, a: 1 },
                            {
                                variableId: "brand",
                                description: "Primary brand color",
                                hiddenFromPublishing: true,
                                variableCollectionId: "brand-collection",
                                key: "brand-key",
                                scopes: ["ALL_FILLS", "TEXT_FILL"],
                                codeSyntax: {
                                    WEB: "--color-brand",
                                    ANDROID: "color_brand",
                                },
                            },
                        ),
                    },
                },
            },
            convertedColorVariableCount: 1,
            issues: [],
        });
    });

    it("reports cyclic color aliases as a dedicated issue", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcg(
                cyclicAliasVariables,
                lightMode,
            ),
        );

        expect(result.tree).toEqual({});
        expect(result.convertedColorVariableCount).toBe(0);
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]).toEqual({
            path: "semantic/color/a",
            code: "cyclic-alias",
            message: "Cannot create token at \"semantic/color/a\": alias chain contains a cycle (semantic/color/a -> semantic/color/b -> semantic/color/a).",
        });
        expect(result.issues[1]).toEqual({
            path: "semantic/color/b",
            code: "cyclic-alias",
            message: "Cannot create token at \"semantic/color/b\": alias chain contains a cycle (semantic/color/b -> semantic/color/a -> semantic/color/b).",
        });
    });

    it("aggregates separate trees for all selected modes", () => {
        const context = loadPluginContext();

        const result = toPlainJson(
            context.convertFigmaVariablesToDtcgForModes(
                multiModeVariables,
                bothModes,
            ),
        );

        expect(result.convertedColorVariableCount).toBe(7);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe("missing-mode-value");
        expect(result.issues[0].message).toMatch(/^\[Dark\]/);
        expect(result.document.$metadata).toEqual({
            tokenSetOrder: ["Light", "Dark"],
        });
        expect(result.document.$themes).toEqual([
            {
                id: "light",
                name: "Light",
                selectedTokenSets: {
                    Light: "enabled",
                },
            },
            {
                id: "dark",
                name: "Dark",
                selectedTokenSets: {
                    Dark: "enabled",
                },
            },
        ]);
        expect(result.document.Light).toEqual({
            primitive: {
                color: {
                    background: createColorToken({ r: 1, g: 1, b: 1, a: 1 }),
                    text: createColorToken({ r: 0, g: 0, b: 0, a: 1 }),
                    accent: createColorToken({ r: 1, g: 0, b: 0, a: 1 }),
                },
            },
            semantic: {
                color: {
                    link: createReferenceToken("{primitive.color.text}"),
                },
            },
        });
        expect(result.document.Dark).toEqual({
            primitive: {
                color: {
                    background: createColorToken({ r: 0, g: 0, b: 0, a: 1 }),
                    text: createColorToken({ r: 1, g: 1, b: 1, a: 1 }),
                },
            },
            semantic: {
                color: {
                    link: createReferenceToken("{primitive.color.text}"),
                },
            },
        });
    });
});
