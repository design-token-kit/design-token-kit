/**
 * Declaration of `CSS.CSSProperty`.
 *
 * Longhands that the browser expands from a shorthand have no `text`, so
 * only authored declarations carry it.
 */
export interface CdpCssProperty {
    /** Property name, e.g. `padding`. */
    readonly name: string;

    /** Value with `var()` kept, as the browser reports it. */
    readonly value: string;

    /** Whether the declaration is marked `!important`. */
    readonly important?: boolean;

    /** Source text of the declaration; absent for expanded longhands. */
    readonly text?: string;

    /** Whether the declaration is commented out. */
    readonly disabled?: boolean;

    /** False when the browser could not parse the declaration. */
    readonly parsedOk?: boolean;
}

/** Declaration block of `CSS.CSSStyle`. */
export interface CdpCssStyle {
    /** Declarations in source order. */
    readonly cssProperties: readonly CdpCssProperty[];
}

/** Origin of a stylesheet, `CSS.StyleSheetOrigin`. */
export type CdpStyleSheetOrigin = "injected" | "user-agent" | "inspector" | "regular";

/** Selector list of `CSS.CSSRule`, `CSS.SelectorList`. */
export interface CdpSelectorList {
    /** Individual selectors of the rule. */
    readonly selectors: readonly { readonly text: string }[];

    /** Whole selector list as written, e.g. `h1, .card`. */
    readonly text: string;
}

/** Style rule of `CSS.CSSRule`. */
export interface CdpCssRule {
    /** Selectors of the rule. */
    readonly selectorList: CdpSelectorList;

    /** Origin of the stylesheet the rule comes from. */
    readonly origin: CdpStyleSheetOrigin;

    /** Declarations of the rule. */
    readonly style: CdpCssStyle;
}

/** Rule matching an element, `CSS.RuleMatch`. */
export interface CdpRuleMatch {
    /** Rule that matches the element. */
    readonly rule: CdpCssRule;

    /** Indexes of the selectors in the rule that match the element. */
    readonly matchingSelectors: readonly number[];
}

/** Styles of one ancestor, `CSS.InheritedStyleEntry`. */
export interface CdpInheritedStyleEntry {
    /** Inline style of the ancestor. */
    readonly inlineStyle?: CdpCssStyle;

    /** Rules matching the ancestor, in increasing cascade priority. */
    readonly matchedCSSRules: readonly CdpRuleMatch[];
}

/**
 * Result of `CSS.getMatchedStylesForNode`.
 *
 * Rules come in increasing cascade priority.
 * `inherited` lists ancestors from the parent up to the root.
 */
export interface CdpMatchedStyles {
    /** Inline style of the element. */
    readonly inlineStyle?: CdpCssStyle;

    /** Rules matching the element, in increasing cascade priority. */
    readonly matchedCSSRules?: readonly CdpRuleMatch[];

    /** Styles of the ancestors, from the parent up to the root. */
    readonly inherited?: readonly CdpInheritedStyleEntry[];
}
