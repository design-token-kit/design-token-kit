export interface TokenNameMapping {
    path: string[];
    architectureWarnings: string[];
}

const TOKEN_LAYER_BY_ALIAS = new Map([
    ["primitive", "primitive"],
    ["primitives", "primitive"],
    ["semantic", "semantic"],
    ["semantics", "semantic"],
    ["component", "component"],
    ["components", "component"],
]);

export function mapColorTokenName(name: string): TokenNameMapping | undefined {
    return mapTokenName(name, ["primitive", "color"]);
}

export function mapTokenName(name: string, fallbackPrefix: string[]): TokenNameMapping | undefined {
    const normalized = name
        .split("/")
        .map((segment) => slugifyPathSegment(segment))
        .filter((segment) => segment !== "");

    if (normalized.length === 0) {
        return undefined;
    }

    const layer = TOKEN_LAYER_BY_ALIAS.get(normalized[0]!);
    if (layer === undefined) {
        return {
            path: [...fallbackPrefix, ...normalized],
            architectureWarnings: [],
        };
    }

    if (normalized.length < 3) {
        return undefined;
    }

    return {
        path: [layer, ...normalized.slice(1)],
        architectureWarnings: layer === normalized[0] ? [] : [
            `${name} uses architecture layer alias "${normalized[0]}"; prefer canonical layer "${layer}".`,
        ],
    };
}

function slugifyPathSegment(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
