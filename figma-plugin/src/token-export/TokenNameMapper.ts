export interface TokenNameMapping {
    path: string[];
}

const TOKEN_LAYERS = new Set(["primitive", "semantic", "component"]);

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

    if (!TOKEN_LAYERS.has(normalized[0]!)) {
        return {
            path: [...fallbackPrefix, ...normalized],
        };
    }

    if (normalized.length < 3) {
        return undefined;
    }

    return {
        path: normalized,
    };
}

function slugifyPathSegment(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
