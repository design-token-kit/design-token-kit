import type { CssDeclaration, CssElementStyles } from "@design-token-kit/core/core/platforms/css/CssTokenTracer";
import type {
    CdpCssProperty,
    CdpCssStyle,
    CdpMatchedStyles,
    CdpRuleMatch,
    CdpSelectorList,
} from "#/browser-extension/cdp/CdpTypes";

/** Display labels of the inspected element and its ancestors. */
export interface ElementLabels {
    /** Label of the inspected element, e.g. `div.card`. */
    readonly element: string;

    /** Labels of the ancestors from the parent up to the root. */
    readonly ancestors: readonly string[];
}

/**
 * Converts matched styles reported by CDP into the cascade-ordered styles
 * that `CssTokenTracer` reads.
 *
 * Keeps author declarations only:
 * user-agent rules, longhands expanded from a shorthand, disabled and
 * unparsed declarations are dropped.
 */
export function toElementStyles(matched: CdpMatchedStyles, labels: ElementLabels): CssElementStyles {
    const ancestors: Array<Omit<CssElementStyles, "parent">> = (matched.inherited ?? []).map((entry, index) => ({
        label: labels.ancestors[index] ?? `ancestor ${index + 1}`,
        declarations: toDeclarations(entry.inlineStyle, entry.matchedCSSRules),
    }));
    const parent: CssElementStyles | undefined = ancestors.reduceRight<CssElementStyles | undefined>(
        (outer, ancestor) => ({ ...ancestor, parent: outer }),
        undefined,
    );
    return {
        label: labels.element,
        declarations: toDeclarations(matched.inlineStyle, matched.matchedCSSRules ?? []),
        parent,
    };
}

const INLINE_STYLE_SELECTOR = "element.style";

function toDeclarations(inlineStyle: CdpCssStyle | undefined, matches: readonly CdpRuleMatch[]): CssDeclaration[] {
    const inline: CssDeclaration[] = inlineStyle === undefined
        ? []
        : styleDeclarations(inlineStyle, INLINE_STYLE_SELECTOR);
    const fromRules: CssDeclaration[] = [...matches]
        .reverse()
        .filter((match) => match.rule.origin !== "user-agent")
        .flatMap((match) => styleDeclarations(match.rule.style, selectorLabel(match)));
    return [...inline, ...fromRules];
}

function selectorLabel(match: CdpRuleMatch): string {
    const list: CdpSelectorList = match.rule.selectorList;
    const matching: string[] = match.matchingSelectors
        .map((index) => list.selectors[index]?.text)
        .filter((text): text is string => text !== undefined);
    return matching.length === 0 ? list.text : matching.join(", ");
}

function styleDeclarations(style: CdpCssStyle, selector: string): CssDeclaration[] {
    return [...style.cssProperties]
        .reverse()
        .filter(isAuthored)
        .map((property) => ({
            property: property.name,
            value: property.value,
            important: property.important === true,
            selector,
        }));
}

function isAuthored(property: CdpCssProperty): boolean {
    return property.text !== undefined && property.disabled !== true && property.parsedOk !== false;
}
