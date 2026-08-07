/**
 * Maps DTCG token paths to Figma entity names.
 *
 * This is the inverse of `token-export/TokenNameMapper`. The export direction is
 * lossy: name segments are slugified to lowercase kebab-case. A strict inverse is
 * therefore impossible, so this mapper emits the canonical form that the exporter
 * maps back to itself.
 *
 * The layer segment is kept in the Figma name. The exporter treats a leading
 * recognized layer as an explicit path and returns it verbatim, so
 * `primitive/color/blue/500` round-trips exactly. Stripping the layer would make
 * the exporter apply a fallback prefix and break the round trip.
 */

/**
 * Converts a DTCG token path to a Figma entity name.
 *
 * Returns `undefined` when the path cannot round-trip through the exporter:
 * when it carries no recognized layer, or when an explicit layer path is too
 * short for the exporter to accept.
 */
export function mapFigmaName(path: string[]): FigmaNameMapping | undefined {
    if (path.length < MIN_EXPLICIT_LAYER_SEGMENTS) {
        return undefined;
    }

    const layer = path[0]!;
    if (!TOKEN_LAYERS.has(layer)) {
        return undefined;
    }

    if (!path.every(isRoundTripSafeSegment)) {
        return undefined;
    }

    return {
        name: path.join(NAME_SEPARATOR),
        layer,
    };
}

export interface FigmaNameMapping {
    /** Figma entity name, e.g. `primitive/color/brand-500`. */
    name: string;
    /** Layer the path belongs to, e.g. `primitive`. */
    layer: string;
}

const TOKEN_LAYERS = new Set(["primitive", "semantic", "component"]);

const NAME_SEPARATOR = "/";

/** Minimum segment count the exporter requires for an explicit layer path. */
const MIN_EXPLICIT_LAYER_SEGMENTS = 3;

/**
 * Reports whether a segment survives the exporter's slugification unchanged.
 *
 * Segments that change under slugification would come back with a different
 * token path, silently breaking the round trip.
 */
export function isRoundTripSafeSegment(segment: string): boolean {
    return segment !== "" && slugifyPathSegment(segment) === segment;
}

/** Mirrors `slugifyPathSegment` in `token-export/TokenNameMapper`. */
function slugifyPathSegment(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
