import {
    createAlias,
    createColorVariable,
    createStringVariable,
    rgba,
} from "./builders";

export const twoColorVariables = [
    createColorVariable("red", "color/red", {
        light: rgba(1, 0, 0),
        dark: rgba(0.8, 0, 0),
    }),
    createColorVariable("blue", "color/blue", {
        light: rgba(0, 0, 1),
        dark: rgba(0, 0, 0.8),
    }),
];

export const aliasChainVariables = [
    createColorVariable("text", "color/text", { light: rgba(0, 0, 0) }),
    createColorVariable("link", "color/link", { light: createAlias("text") }),
];

export const conflictingPathVariables = [
    createColorVariable("red", "color/red", { light: rgba(1, 0, 0) }),
    createColorVariable("red-500", "color/red/500", { light: rgba(0.8, 0, 0) }),
];

export const singleColorVariable = [
    createColorVariable("accent", "color/accent", { light: rgba(1, 0, 0) }),
];

export const nonColorVariables = [
    createStringVariable("title", "content/title", { light: "Heading" }),
];

export const unresolvedAliasVariables = [
    createStringVariable("title", "content/title", { light: "Heading" }),
    createColorVariable("link", "color/link", { light: createAlias("title") }),
];

export const crossCollectionAliasVariables = [
    createColorVariable("link", "color/link", {
        light: createAlias("brand-primary"),
    }),
];

export const crossCollectionAliasLookupVariables = [
    ...crossCollectionAliasVariables,
    createColorVariable("brand-primary", "brand/primary", {
        light: rgba(0.2, 0.4, 0.6),
    }),
];

export const metadataColorVariables = [
    createColorVariable(
        "brand",
        "color/brand",
        { light: rgba(0.145, 0.286, 0.965) },
        {
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
];

export const cyclicAliasVariables = [
    createColorVariable("a", "color/a", {
        light: createAlias("b"),
    }),
    createColorVariable("b", "color/b", {
        light: createAlias("a"),
    }),
];

export const multiModeVariables = [
    createColorVariable("background", "color/background", {
        light: rgba(1, 1, 1),
        dark: rgba(0, 0, 0),
    }),
    createColorVariable("text", "color/text", {
        light: rgba(0, 0, 0),
        dark: rgba(1, 1, 1),
    }),
    createColorVariable("link", "color/link", {
        light: createAlias("text"),
        dark: createAlias("text"),
    }),
    createColorVariable("accent", "color/accent", {
        light: rgba(1, 0, 0),
    }),
];

export const lightMode = { modeId: "light", label: "Light" } as const;
export const darkMode = { modeId: "dark", label: "Dark" } as const;
export const bothModes = [lightMode, darkMode];
