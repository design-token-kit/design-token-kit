import type {
    CssDeclaration,
    CssElementStyles,
} from "@design-token-kit/core/browser";

/**
 * Converts the CSS-domain subset returned by Chrome DevTools Protocol into
 * the browser-independent styles model used by the token tracer.
 */
export class CdpStylesAdapter {

    /**
     * Converts matched CSS styles for the selected node and its ancestors.
     */
    toElementStyles(
        label: string,
        matchedStyles: CdpMatchedStyles,
        ancestorLabels: readonly string[] = [],
    ): CssElementStyles {
        let parent: CssElementStyles | undefined;
        const inherited = matchedStyles.inherited ?? [];
        for (let index = inherited.length - 1; index >= 0; index--) {
            parent = {
                label: ancestorLabels[index] ?? `ancestor ${index + 1}`,
                declarations: declarationsFrom(inherited[index]),
                parent,
            };
        }

        return {
            label,
            declarations: declarationsFrom(matchedStyles),
            parent,
        };
    }

    /**
     * Converts computed CSS values into a map keyed by property name.
     */
    toComputedValues(computedStyles: readonly CdpComputedStyleProperty[]): ReadonlyMap<string, string> {
        return new Map(computedStyles
            .filter((property) => property.name !== undefined && property.value !== undefined)
            .map((property) => [property.name!, property.value!]));
    }
}

/**
 * CSS.getMatchedStylesForNode response subset used by the adapter.
 */
export interface CdpMatchedStyles {
    readonly inlineStyle?: CdpStyle;
    readonly matchedCSSRules?: readonly CdpMatchedRule[];
    readonly inherited?: readonly CdpInheritedStyle[];
}

/**
 * CSS.getComputedStyleForNode item subset used by the adapter.
 */
export interface CdpComputedStyleProperty {
    readonly name?: string;
    readonly value?: string;
}

export interface CdpInheritedStyle {
    readonly inlineStyle?: CdpStyle;
    readonly matchedCSSRules?: readonly CdpMatchedRule[];
}

export interface CdpMatchedRule {
    readonly rule?: CdpRule;
}

export interface CdpRule {
    readonly selectorList?: {
        readonly text?: string;
    };
    readonly style?: CdpStyle;
    readonly origin?: "regular" | "user-agent" | "inspector" | "user" | "injected";
}

export interface CdpStyle {
    readonly styleSheetId?: string;
    readonly cssProperties?: readonly CdpCssProperty[];
}

export interface CdpCssProperty {
    readonly name?: string;
    readonly value?: string;
    readonly important?: boolean;
    readonly disabled?: boolean;
}

function declarationsFrom(styles: CdpMatchedStyles | CdpInheritedStyle): CssDeclaration[] {
    const declarations: CssDeclaration[] = [];
    if (styles.inlineStyle !== undefined) {
        declarations.push(...toDeclarations(styles.inlineStyle, "element.style"));
    }
    const matchedRules = [...(styles.matchedCSSRules ?? [])].reverse();
    for (const matchedRule of matchedRules) {
        if (matchedRule.rule?.style === undefined || matchedRule.rule.origin === "user-agent") continue;
        declarations.push(...toDeclarations(
            matchedRule.rule.style,
            matchedRule.rule.selectorList?.text ?? "<anonymous rule>",
        ));
    }
    return declarations.sort((left, right) =>
        Number(right.important) - Number(left.important),
    );
}

function toDeclarations(style: CdpStyle, selector: string): CssDeclaration[] {
    const declarations = (style.cssProperties ?? [])
        .filter((property) =>
            property.disabled !== true
            && property.name !== undefined
            && property.value !== undefined,
        )
        .map((property) => ({
            property: property.name!,
            value: property.value!,
            important: property.important === true,
            selector,
        }));
    return declarations
        .map((declaration, index) => ({ declaration, index }))
        .sort((left, right) => {
            const importantOrder = Number(right.declaration.important)
                - Number(left.declaration.important);
            return importantOrder === 0 ? right.index - left.index : importantOrder;
        })
        .map((entry) => entry.declaration);
}
