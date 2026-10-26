import type { TokenLayers } from "#/core/check/TokenLayers";
import type { CssTokenMap, CssTokenMapEntry } from "#/core/platforms/css/CssTokenMap";
import { isCustomProperty, isInheritedProperty } from "#/core/platforms/css/CssInheritedProperties";
import {
    findSoleVarReference,
    findVarReferences,
    type CssVarReference,
} from "#/core/platforms/css/CssVarReferences";

/**
 * Traces CSS properties of an element back to the tokens they use.
 *
 * Follows `var()` references through custom property declarations the way
 * the browser substitutes them, and names each custom property with its
 * token when a CSS token map is given.
 * Works on declarations already ordered by the cascade;
 * finding and ordering them is the caller's job.
 */
export class CssTokenTracer {
    readonly #map: CssTokenMap | undefined;
    readonly #layers: TokenLayers;

    /**
     * @param map - Map of the converted CSS; without it links carry only
     *   custom property names.
     * @param layers - Layer order used to name the layer of a token path.
     */
    constructor(map: CssTokenMap | undefined, layers: TokenLayers) {
        this.#map = map;
        this.#layers = layers;
    }

    /**
     * Traces every property declared on the element or inherited by it.
     *
     * Own properties come first, then inherited ones, each group sorted by
     * property name.
     *
     * @param element - Styles of the element and, through `parent`, of its
     *   ancestors.
     * @param computed - Computed values of the element by property name.
     */
    trace(element: CssElementStyles, computed: ReadonlyMap<string, string>): CssPropertyTrace[] {
        return tracedProperties(element).map((property) => this.#traceProperty(element, property, computed));
    }

    #traceProperty(
        element: CssElementStyles,
        property: string,
        computed: ReadonlyMap<string, string>,
    ): CssPropertyTrace {
        const winner: FoundDeclaration = requireDeclaration(element, property);
        return {
            property,
            declaration: winner.declaration,
            inheritedFrom: winner.styles === element ? undefined : winner.styles.label,
            chains: findVarReferences(winner.declaration.value)
                .map((reference) => this.#traceChain(reference, winner.styles)),
            computedValue: computed.get(property) ?? "",
        };
    }

    #traceChain(reference: CssVarReference, scope: CssElementStyles): CssTokenChain {
        const links: CssTokenLink[] = [];
        const visited: Map<CssElementStyles, Set<string>> = new Map();
        let current: CssVarReference = reference;
        let currentScope: CssElementStyles = scope;
        while (true) {
            const found: FoundDeclaration | undefined = findDeclaration(currentScope, current.customProperty);
            // A browser treats every property in a reference cycle as invalid.
            if (found === undefined || !markVisited(visited, found.styles, current.customProperty)) {
                return { links, end: undefinedEnd(current) };
            }
            links.push(this.#toLink(found.declaration));
            const next: CssVarReference | undefined = findSoleVarReference(found.declaration.value);
            if (next === undefined) return { links, end: { kind: "value", value: found.declaration.value } };
            current = next;
            currentScope = found.styles;
        }
    }

    #toLink(declaration: CssDeclaration): CssTokenLink {
        const token: CssTokenMapEntry | undefined = this.#map?.findByCustomProperty(declaration.property);
        return {
            customProperty: declaration.property,
            declaration,
            token,
            layer: token === undefined ? undefined : this.#layers.layerOf(token.path),
            theme: themeOf(declaration.selector),
        };
    }
}

/** Declarations that apply to one element, and the same for its parent. */
export interface CssElementStyles {
    /** Short element description for display, e.g. `div.card`. */
    readonly label: string;

    /**
     * Declarations matching the element, highest cascade priority first.
     * The order ignores `!important`; the tracer applies it itself.
     */
    readonly declarations: readonly CssDeclaration[];

    /** Styles of the parent element; undefined for the root element. */
    readonly parent: CssElementStyles | undefined;
}

/** One authored declaration of a style rule or inline style. */
export interface CssDeclaration {
    /** Property name, e.g. `background` or `--semantic-color-surface`. */
    readonly property: string;

    /** Value as authored, with `var()` kept, e.g. `var(--a, #fff)`. */
    readonly value: string;

    /** Whether the declaration is marked `!important`. */
    readonly important: boolean;

    /** Selector of the rule, or `element.style` for the inline style. */
    readonly selector: string;
}

/** Where the value of one property of the element comes from. */
export interface CssPropertyTrace {
    /** Property name, e.g. `background`. */
    readonly property: string;

    /** Winning declaration of the property. */
    readonly declaration: CssDeclaration;

    /**
     * Label of the ancestor the value is inherited from.
     * Undefined when declared on the element.
     */
    readonly inheritedFrom: string | undefined;

    /**
     * One chain per `var()` in the value.
     * Empty when the value uses no custom property.
     */
    readonly chains: readonly CssTokenChain[];

    /**
     * Computed value of the property on the element.
     * Empty when the caller did not provide it.
     */
    readonly computedValue: string;
}

/**
 * Custom properties followed from one `var()` down to a value without
 * references.
 */
export interface CssTokenChain {
    /**
     * Links from the referenced custom property to the last one.
     * Ordered by substitution.
     */
    readonly links: readonly CssTokenLink[];

    /** How the chain ends. */
    readonly end: CssTokenChainEnd;
}

/** One custom property in a chain. */
export interface CssTokenLink {
    /** Custom property name, e.g. `--semantic-color-surface`. */
    readonly customProperty: string;

    /** Declaration of the custom property that the browser substitutes. */
    readonly declaration: CssDeclaration;

    /**
     * Token the property was converted from.
     * Undefined without a map or for a property not produced by conversion.
     */
    readonly token: CssTokenMapEntry | undefined;

    /**
     * Token layer, e.g. `semantic`.
     * Undefined when the token is unknown or its first segment is not a layer.
     */
    readonly layer: string | undefined;

    /**
     * Theme from a `[data-theme="..."]` selector of the declaration.
     * Undefined for the base set.
     */
    readonly theme: string | undefined;
}

/** How a chain ends: at a value, or at a custom property nobody declared. */
export type CssTokenChainEnd =
    | { readonly kind: "value"; readonly value: string }
    | { readonly kind: "undefined"; readonly customProperty: string; readonly fallback: string | undefined };

const THEME_SELECTOR: RegExp = /\[data-theme=(["']?)([^"'\]]+)\1\]/;

/** A winning declaration and the element whose styles declare it. */
interface FoundDeclaration {
    readonly declaration: CssDeclaration;
    readonly styles: CssElementStyles;
}

function tracedProperties(element: CssElementStyles): string[] {
    const own: string[] = standardProperties(element).sort();
    const inherited: Set<string> = new Set();
    let ancestor: CssElementStyles | undefined = element.parent;
    while (ancestor !== undefined) {
        standardProperties(ancestor)
            .filter((property) => isInheritedProperty(property) && !own.includes(property))
            .forEach((property) => inherited.add(property));
        ancestor = ancestor.parent;
    }
    return [...own, ...[...inherited].sort()];
}

function standardProperties(styles: CssElementStyles): string[] {
    const properties: Set<string> = new Set(styles.declarations
        .map((declaration) => declaration.property)
        .filter((property) => !isCustomProperty(property)));
    return [...properties];
}

function requireDeclaration(element: CssElementStyles, property: string): FoundDeclaration {
    const found: FoundDeclaration | undefined = findDeclaration(element, property);
    if (found === undefined) throw new Error(`No declaration of ${property} on ${element.label}`);
    return found;
}

function findDeclaration(styles: CssElementStyles, property: string): FoundDeclaration | undefined {
    for (let current: CssElementStyles | undefined = styles; current !== undefined; current = current.parent) {
        const declaration: CssDeclaration | undefined = winningDeclarationOf(current, property);
        if (declaration !== undefined) return { declaration, styles: current };
        if (!isInheritedProperty(property)) return undefined;
    }
    return undefined;
}

function winningDeclarationOf(styles: CssElementStyles, property: string): CssDeclaration | undefined {
    const candidates: CssDeclaration[] = styles.declarations
        .filter((declaration) => declaration.property === property);
    return candidates.find((declaration) => declaration.important) ?? candidates[0];
}

function markVisited(
    visited: Map<CssElementStyles, Set<string>>,
    styles: CssElementStyles,
    property: string,
): boolean {
    const properties: Set<string> = visited.get(styles) ?? new Set();
    visited.set(styles, properties);
    if (properties.has(property)) return false;
    properties.add(property);
    return true;
}

function undefinedEnd(reference: CssVarReference): CssTokenChainEnd {
    return { kind: "undefined", customProperty: reference.customProperty, fallback: reference.fallback };
}

function themeOf(selector: string): string | undefined {
    return THEME_SELECTOR.exec(selector)?.[2];
}
