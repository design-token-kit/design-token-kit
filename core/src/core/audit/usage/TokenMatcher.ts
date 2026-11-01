import { colorDistance } from "#/core/audit/color/ColorDistance";
import { formatSrgbColor } from "#/core/audit/color/SrgbColor";
import type { TokenCandidate, UsageProperty, UsageValue } from "#/core/audit/usage/UsageSample";
import { TokenLayers } from "#/core/check/TokenLayers";

/**
 * A token whose value matches a hard-coded value.
 */
export interface TokenMatch {
    readonly candidate: TokenCandidate;

    /** Whether the values are equal, rather than only close. */
    readonly exact: boolean;
}

/**
 * Options of {@link TokenMatcher}.
 */
export interface TokenMatcherOptions {
    /** Largest Oklab distance at which two colors count as close. Defaults to 0.02. */
    readonly colorTolerance?: number;

    /** Largest difference in px at which two dimensions count as close. Defaults to 1. */
    readonly dimensionTolerancePx?: number;

    /** Token layers, lowest first. Defaults to primitive, semantic, component. */
    readonly layers?: readonly string[];
}

const DEFAULT_COLOR_TOLERANCE = 0.02;
const DEFAULT_DIMENSION_TOLERANCE_PX = 1;
const ALPHA_TOLERANCE = 0.01;
const EXACT_DIMENSION_DELTA = 0.005;

/**
 * Finds the token a hard-coded value could be replaced with.
 *
 * Colors match exactly when they are the same 8-bit `#rrggbbaa`, and closely
 * when their Oklab distance is within the tolerance and their alpha is equal.
 * Dimensions match closely when they differ by at most the tolerance.
 *
 * Of several matching tokens the best is chosen: an exact match over a close
 * one, then by layer, then the nearest value, then by name. Layers rank the
 * one above the lowest first, as UI should use semantic tokens; then the
 * lowest layer, then the higher ones, then tokens that declare no layer.
 */
export class TokenMatcher {
    readonly #candidates: readonly TokenCandidate[];
    readonly #colorTolerance: number;
    readonly #dimensionTolerancePx: number;
    readonly #layers: TokenLayers;

    constructor(candidates: readonly TokenCandidate[], options: TokenMatcherOptions = {}) {
        this.#candidates = candidates;
        this.#colorTolerance = options.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
        this.#dimensionTolerancePx = options.dimensionTolerancePx ?? DEFAULT_DIMENSION_TOLERANCE_PX;
        this.#layers = new TokenLayers(options.layers === undefined ? TokenLayers.DEFAULT_ORDER : [...options.layers]);
    }

    /**
     * Finds the best token for a value of a property.
     *
     * @param accept - Narrows the candidates, e.g. to a layer.
     * @returns The best match, or `undefined` when no token is close enough.
     */
    match(
        property: UsageProperty,
        value: UsageValue,
        accept: (candidate: TokenCandidate) => boolean = () => true,
    ): TokenMatch | undefined {
        let best: RankedMatch | undefined;
        for (const candidate of this.#candidates) {
            if (!appliesTo(candidate, property) || !accept(candidate)) continue;
            const distance = this.#distance(value, candidate.value);
            if (distance === undefined) continue;

            const ranked: RankedMatch = { candidate, ...distance, layerRank: this.#layerRank(candidate.layer) };
            if (best === undefined || compare(ranked, best) < 0) {
                best = ranked;
            }
        }
        return best === undefined ? undefined : { candidate: best.candidate, exact: best.exact };
    }

    #distance(value: UsageValue, target: UsageValue): { exact: boolean; distance: number } | undefined {
        if (value.type === "color" && target.type === "color") {
            if (formatSrgbColor(value.color) === formatSrgbColor(target.color)) return { exact: true, distance: 0 };
            if (Math.abs(value.color.alpha - target.color.alpha) > ALPHA_TOLERANCE) return undefined;
            const distance = colorDistance(value.color, target.color);
            return distance <= this.#colorTolerance ? { exact: false, distance } : undefined;
        }
        if (value.type === "dimension" && target.type === "dimension") {
            const distance = Math.abs(value.px - target.px);
            if (distance < EXACT_DIMENSION_DELTA) return { exact: true, distance: 0 };
            return distance <= this.#dimensionTolerancePx ? { exact: false, distance } : undefined;
        }
        return undefined;
    }

    #layerRank(layer: string | undefined): number {
        const index = layer === undefined ? -1 : this.#layers.indexOf(layer);
        if (index === 1) return 0;
        if (index === 0) return 1;
        return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    }
}

interface RankedMatch {
    readonly candidate: TokenCandidate;
    readonly exact: boolean;
    readonly distance: number;
    readonly layerRank: number;
}

function appliesTo(candidate: TokenCandidate, property: UsageProperty): boolean {
    return candidate.properties === undefined || candidate.properties.includes(property);
}

function compare(first: RankedMatch, second: RankedMatch): number {
    return Number(second.exact) - Number(first.exact)
        || first.layerRank - second.layerRank
        || first.distance - second.distance
        || first.candidate.name.localeCompare(second.candidate.name);
}
