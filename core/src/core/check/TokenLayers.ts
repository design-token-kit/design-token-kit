import { TokenPath } from "#/core/model/TokenPath";

/**
 * The configured token layers (e.g. primitive / semantic / component), ordered
 * from the lowest (raw-defining) layer to the highest.
 *
 * A token's layer is the first segment of its dotted path. The allowed
 * reference edges follow from the order: a token at layer N may reference only
 * the adjacent lower layer N-1.
 */
export class TokenLayers {
    static readonly DEFAULT_ORDER = ["primitive", "semantic", "component"];

    readonly #order: string[];

    /**
     * @param order - Layer names from lowest to highest.
     */
    constructor(order: string[] = TokenLayers.DEFAULT_ORDER) {
        this.#order = [...order];
    }

    static default(): TokenLayers {
        return new TokenLayers();
    }

    /**
     * Returns all layer names, from lowest to highest.
     */
    names(): string[] {
        return [...this.#order];
    }

    /**
     * Returns the lowest layer (the only one allowed to define raw values).
     */
    lowest(): string {
        return this.#order[0];
    }

    /**
     * Returns the layer a token path belongs to, or undefined when not configured.
     */
    layerOf(path: TokenPath): string | undefined {
        const first = path.head();
        return first !== undefined && this.has(first) ? first : undefined;
    }

    /**
     * Returns the order index of a layer, or -1 when unknown.
     */
    indexOf(layer: string): number {
        return this.#order.indexOf(layer);
    }

    has(layer: string): boolean {
        return this.#order.includes(layer);
    }

    /**
     * Returns true when a reference from {@code fromLayer} to {@code toLayer} is
     * allowed: only a reference to the adjacent lower layer (N -> N-1).
     */
    isAllowedEdge(fromLayer: string, toLayer: string): boolean {
        const from = this.indexOf(fromLayer);
        const to = this.indexOf(toLayer);
        if (from < 0 || to < 0) return false;
        return to === from - 1;
    }
}
