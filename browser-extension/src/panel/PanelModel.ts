import type {
    CssPropertyTrace,
    CssTokenChain,
    CssTokenChainEnd,
    CssTokenLink,
} from "@design-token-kit/core/core/platforms/css/CssTokenTracer";

/** What the panel shows for one property of the selected element. */
export interface PropertyView {
    /** Property name, e.g. `background`. */
    readonly property: string;

    /**
     * Selector of the winning rule,
     * or which ancestor the value is inherited from.
     */
    readonly origin: string;

    /** Value the browser computed for the property; empty when unknown. */
    readonly computedValue: string;

    /** Token chains of the value. */
    readonly chains: readonly ChainView[];

    /**
     * Value set without tokens;
     * undefined when the value uses custom properties.
     */
    readonly rawValue: string | undefined;
}

/** One chain as shown in the panel. */
export interface ChainView {
    /** Links from the property to the final value. */
    readonly links: readonly LinkView[];

    /** Final line of the chain, e.g. `= #ffffff`. */
    readonly ending: string;

    /** Description of the first token, the one the property refers to. */
    readonly description: string | undefined;
}

/** One chain link; clicking it copies the title. */
export interface LinkView {
    /** Token path, or the custom property name when the token is unknown. */
    readonly title: string;

    /** Theme the link comes from; undefined for the base set. */
    readonly theme: string | undefined;
}

/**
 * Turns traces into the text the panel shows.
 */
export function toPropertyViews(traces: readonly CssPropertyTrace[]): PropertyView[] {
    return traces.map((trace) => ({
        property: trace.property,
        origin: trace.inheritedFrom === undefined
            ? trace.declaration.selector
            : `inherited from ${trace.inheritedFrom}`,
        computedValue: trace.computedValue,
        chains: trace.chains.map(toChainView),
        rawValue: trace.chains.length === 0 ? trace.declaration.value : undefined,
    }));
}

function toChainView(chain: CssTokenChain): ChainView {
    return {
        links: chain.links.map(toLinkView),
        ending: describeEnd(chain.end),
        description: chain.links[0]?.token?.description,
    };
}

function toLinkView(link: CssTokenLink): LinkView {
    return { title: link.token?.path.toString() ?? link.customProperty, theme: link.theme };
}

function describeEnd(end: CssTokenChainEnd): string {
    if (end.kind === "value") return `= ${end.value}`;
    const fallback: string = end.fallback === undefined ? "" : `, fallback: ${end.fallback}`;
    return `${end.customProperty} is not defined${fallback}`;
}
