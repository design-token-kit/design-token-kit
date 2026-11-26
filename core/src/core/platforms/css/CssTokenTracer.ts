import { TokenLayers } from "#/core/check/TokenLayers";
import type { CssTokenMap, CssTokenMapEntry } from "#/core/platforms/css/CssTokenMap";

/**
 * Traces authored CSS custom property references back to design tokens.
 *
 * Declarations must already be ordered by the browser cascade, with the
 * winning declaration first for each property.
 */
export class CssTokenTracer {

    readonly #map: CssTokenMap | undefined;
    readonly #layers: TokenLayers;

    /**
     * Creates a tracer with optional token metadata and configured layers.
     */
    constructor(map: CssTokenMap | undefined, layers: TokenLayers) {
        this.#map = map;
        this.#layers = layers;
    }

    /**
     * Traces authored declarations for the computed properties of an element.
     */
    trace(
        element: CssElementStyles,
        computed: ReadonlyMap<string, string>,
    ): CssPropertyTrace[] {
        const traces: CssPropertyTrace[] = [];
        const authoredPropertySet = authoredProperties(element);
        for (const [property, computedValue] of computed) {
            if (property.startsWith("--")) continue;
            if (isExpandedByTokenShorthand(element, property)) continue;

            const declarationSource = findDeclaration(element, property);
            if (declarationSource === undefined) continue;

            traces.push(this.traceProperty(element, property, declarationSource, computedValue));
        }

        for (const property of authoredPropertySet) {
            if (property.startsWith("--") || computed.has(property)) continue;

            const declarationSource = findDeclaration(element, property);
            if (declarationSource === undefined) continue;
            if (findVarReferences(declarationSource.declaration.value).length === 0) continue;

            traces.push(this.traceProperty(
                element,
                property,
                declarationSource,
                undefined,
            ));
        }
        const authoredOrder = new Map<string, number>(
            [...authoredPropertySet].map((property, index): [string, number] => [property, index]),
        );
        return traces.sort((left, right) => {
            const tokenPriority = Number(right.chains.length > 0) - Number(left.chains.length > 0);
            if (tokenPriority !== 0) return tokenPriority;
            return (authoredOrder.get(left.property) ?? Number.MAX_SAFE_INTEGER)
                - (authoredOrder.get(right.property) ?? Number.MAX_SAFE_INTEGER);
        });
    }

    private traceProperty(
        element: CssElementStyles,
        property: string,
        declarationSource: CssDeclarationSource,
        computedValue: string | undefined,
    ): CssPropertyTrace {
        const references = findVarReferences(declarationSource.declaration.value);
        const chains = references.flatMap((reference) =>
            this.traceReference(element, reference, [], new Set()),
        );
        return {
            property,
            declaration: declarationSource.declaration,
            inheritedFrom: declarationSource.inheritedFrom,
            chains,
            computedValue,
        };
    }

    private traceReference(
        element: CssElementStyles,
        reference: CssVarReference,
        links: readonly CssTokenLink[],
        visited: ReadonlySet<string>,
    ): CssTokenChain[] {
        if (visited.has(reference.customProperty)) {
            return [{
                links,
                end: {
                    kind: "undefined",
                    customProperty: reference.customProperty,
                    fallback: reference.fallback,
                },
            }];
        }

        const declarationSource = findDeclaration(element, reference.customProperty);
        if (declarationSource === undefined) {
            return [{
                links,
                end: {
                    kind: "undefined",
                    customProperty: reference.customProperty,
                    fallback: reference.fallback,
                },
            }];
        }

        const link = this.toLink(reference.customProperty, declarationSource.declaration);
        const nextLinks = [...links, link];
        const nextReferences = findVarReferences(declarationSource.declaration.value);
        if (nextReferences.length === 0) {
            return [{
                links: nextLinks,
                end: {
                    kind: "value",
                    value: declarationSource.declaration.value,
                },
            }];
        }

        const nextVisited = new Set(visited);
        nextVisited.add(reference.customProperty);
        return nextReferences.flatMap((nextReference) =>
            this.traceReference(element, nextReference, nextLinks, nextVisited),
        );
    }

    private toLink(customProperty: string, declaration: CssDeclaration): CssTokenLink {
        const token = this.#map?.findByCustomProperty(customProperty);
        return {
            customProperty,
            declaration,
            token,
            layer: token === undefined ? undefined : this.#layers.layerOf(token.path),
            theme: themeFromSelector(declaration.selector),
        };
    }
}

/**
 * Matched declarations for an element and its parent.
 */
export interface CssElementStyles {
    readonly label: string;
    readonly declarations: readonly CssDeclaration[];
    readonly parent: CssElementStyles | undefined;
}

/**
 * One authored CSS declaration.
 */
export interface CssDeclaration {
    readonly property: string;
    readonly value: string;
    readonly important: boolean;
    readonly selector: string;
}

/**
 * The provenance of one computed CSS property.
 */
export interface CssPropertyTrace {
    readonly property: string;
    readonly declaration: CssDeclaration;
    readonly inheritedFrom: string | undefined;
    readonly chains: readonly CssTokenChain[];
    readonly computedValue: string | undefined;
}

/**
 * One path through custom property substitutions.
 */
export interface CssTokenChain {
    readonly links: readonly CssTokenLink[];
    readonly end: CssTokenChainEnd;
}

/**
 * One custom property substitution in a trace.
 */
export interface CssTokenLink {
    readonly customProperty: string;
    readonly declaration: CssDeclaration;
    readonly token: CssTokenMapEntry | undefined;
    readonly layer: string | undefined;
    readonly theme: string | undefined;
}

/**
 * The result of following a custom property substitution.
 */
export type CssTokenChainEnd =
    | {
        readonly kind: "value";
        readonly value: string;
    }
    | {
        readonly kind: "undefined";
        readonly customProperty: string;
        readonly fallback: string | undefined;
    };

interface CssDeclarationSource {
    readonly declaration: CssDeclaration;
    readonly inheritedFrom: string | undefined;
}

interface CssVarReference {
    readonly customProperty: string;
    readonly fallback: string | undefined;
}

function findDeclaration(
    element: CssElementStyles,
    property: string,
): CssDeclarationSource | undefined {
    const ownDeclaration = element.declarations
        .find((declaration) => declaration.property === property);
    if (ownDeclaration !== undefined) {
        return {
            declaration: ownDeclaration,
            inheritedFrom: undefined,
        };
    }
    if (element.parent === undefined || !canInherit(property)) return undefined;

    const inherited = findDeclaration(element.parent, property);
    if (inherited === undefined) return undefined;
    return {
        declaration: inherited.declaration,
        inheritedFrom: inherited.inheritedFrom ?? element.parent.label,
    };
}

function canInherit(property: string): boolean {
    return property.startsWith("--") || INHERITABLE_PROPERTIES.has(property)
        || property.startsWith("font-") || property.startsWith("text-");
}

const INHERITABLE_PROPERTIES: ReadonlySet<string> = new Set([
    "color",
    "cursor",
    "direction",
    "font",
    "letter-spacing",
    "line-height",
    "list-style",
    "quotes",
    "text-align",
    "text-indent",
    "text-transform",
    "visibility",
    "white-space",
    "word-spacing",
    "writing-mode",
]);

function authoredProperties(element: CssElementStyles): Set<string> {
    const properties = new Set<string>();
    let current: CssElementStyles | undefined = element;
    while (current !== undefined) {
        for (const declaration of current.declarations) properties.add(declaration.property);
        current = current.parent;
    }
    return properties;
}

function isExpandedByTokenShorthand(element: CssElementStyles, property: string): boolean {
    for (const shorthand of Object.keys(SHORTHAND_EXPANSIONS)) {
        if (!SHORTHAND_EXPANSIONS[shorthand].includes(property)) continue;

        const declaration = findDeclaration(element, shorthand);
        if (declaration !== undefined && findVarReferences(declaration.declaration.value).length > 0) {
            return true;
        }
    }
    return false;
}

const SHORTHAND_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
    background: [
        "background-attachment",
        "background-clip",
        "background-color",
        "background-image",
        "background-origin",
        "background-position",
        "background-position-x",
        "background-position-y",
        "background-repeat",
        "background-size",
    ],
    border: [
        "border-bottom-color",
        "border-bottom-style",
        "border-bottom-width",
        "border-left-color",
        "border-left-style",
        "border-left-width",
        "border-right-color",
        "border-right-style",
        "border-right-width",
        "border-top-color",
        "border-top-style",
        "border-top-width",
    ],
    padding: [
        "padding-block-end",
        "padding-block-start",
        "padding-bottom",
        "padding-inline-end",
        "padding-inline-start",
        "padding-left",
        "padding-right",
        "padding-top",
    ],
    margin: [
        "margin-block-end",
        "margin-block-start",
        "margin-bottom",
        "margin-inline-end",
        "margin-inline-start",
        "margin-left",
        "margin-right",
        "margin-top",
    ],
};

function findVarReferences(value: string): CssVarReference[] {
    const references: CssVarReference[] = [];
    let index = 0;
    while (index < value.length) {
        const start = value.indexOf("var(", index);
        if (start < 0) break;

        const end = findClosingParenthesis(value, start + 3);
        if (end === undefined) break;

        const reference = parseVarArguments(value.slice(start + 4, end));
        if (reference !== undefined) references.push(reference);
        index = end + 1;
    }
    return references;
}

function findClosingParenthesis(value: string, openParenthesis: number): number | undefined {
    let depth = 0;
    for (let index = openParenthesis; index < value.length; index++) {
        if (value[index] === "(") depth++;
        if (value[index] !== ")") continue;

        depth--;
        if (depth === 0) return index;
    }
    return undefined;
}

function parseVarArguments(argumentsValue: string): CssVarReference | undefined {
    const commaIndex = findTopLevelComma(argumentsValue);
    const customProperty = (commaIndex < 0 ? argumentsValue : argumentsValue.slice(0, commaIndex)).trim();
    if (!customProperty.startsWith("--")) return undefined;

    const fallback = commaIndex < 0 ? undefined : argumentsValue.slice(commaIndex + 1).trim();
    return {
        customProperty,
        fallback: fallback || undefined,
    };
}

function findTopLevelComma(value: string): number {
    let depth = 0;
    for (let index = 0; index < value.length; index++) {
        if (value[index] === "(") depth++;
        if (value[index] === ")") depth--;
        if (value[index] === "," && depth === 0) return index;
    }
    return -1;
}

function themeFromSelector(selector: string): string | undefined {
    const match = /\[data-theme\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\]\s]+))\]/.exec(selector);
    return match?.[1] ?? match?.[2] ?? match?.[3];
}
