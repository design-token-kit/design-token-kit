import { TokenPath } from "#/core/model/TokenPath";
import type { TokenType } from "#/core/model/TokenType";

/**
 * Maps CSS custom properties produced by token conversion to their source
 * design tokens.
 */
export class CssTokenMap {

    /**
     * Version of the serialized JSON representation.
     */
    static readonly VERSION = 1;

    /**
     * Custom property containing the URL of the map file.
     */
    static readonly LOCATOR_PROPERTY = "--dtokens-map";

    readonly #entries: readonly CssTokenMapEntry[];
    readonly #entriesByCustomProperty: ReadonlyMap<string, CssTokenMapEntry>;

    /**
     * Creates a map from CSS custom properties to tokens.
     *
     * @throws Error when two entries use the same custom property.
     */
    constructor(entries: readonly CssTokenMapEntry[]) {
        const entriesByCustomProperty = new Map<string, CssTokenMapEntry>();
        const copiedEntries: CssTokenMapEntry[] = [];

        for (const entry of entries) {
            validateEntry(entry);
            if (entriesByCustomProperty.has(entry.customProperty)) {
                throw new Error(`CSS custom property "${entry.customProperty}" maps to more than one token.`);
            }

            const copiedEntry = freezeEntry(entry);
            entriesByCustomProperty.set(copiedEntry.customProperty, copiedEntry);
            copiedEntries.push(copiedEntry);
        }

        this.#entries = Object.freeze(copiedEntries);
        this.#entriesByCustomProperty = entriesByCustomProperty;
    }

    /**
     * Restores a token map from a JSON representation.
     */
    static fromJson(json: string): CssTokenMapReadResult {
        let value: unknown;
        try {
            value = JSON.parse(json);
        } catch {
            return { ok: false, reason: "Map is not valid JSON." };
        }

        if (!isRecord(value)) {
            return { ok: false, reason: "Map must be a JSON object." };
        }
        if (value.version !== CssTokenMap.VERSION) {
            return {
                ok: false,
                reason: `Unsupported map version "${String(value.version)}". Expected ${CssTokenMap.VERSION}.`,
            };
        }
        if (!isRecord(value.customProperties)) {
            return { ok: false, reason: "Map customProperties must be a JSON object." };
        }

        try {
            const entries = Object.entries(value.customProperties).map(([customProperty, serialized]) =>
                parseEntry(customProperty, serialized),
            );
            return { ok: true, map: new CssTokenMap(entries) };
        } catch (error) {
            return { ok: false, reason: (error as Error).message };
        }
    }

    /**
     * Finds the token represented by a CSS custom property.
     */
    findByCustomProperty(customProperty: string): CssTokenMapEntry | undefined {
        return this.#entriesByCustomProperty.get(customProperty);
    }

    /**
     * Returns entries in CSS conversion order.
     */
    entries(): readonly CssTokenMapEntry[] {
        return this.#entries;
    }

    /**
     * Serializes this map to JSON.
     */
    toJson(): string {
        const customProperties: Record<string, CssTokenMapJsonEntry> = {};
        for (const entry of this.#entries) {
            customProperties[entry.customProperty] = {
                path: entry.path.toString(),
                type: entry.type,
                description: entry.description,
                source: entry.source,
            };
        }

        return JSON.stringify({
            version: CssTokenMap.VERSION,
            customProperties,
        }, undefined, 2) + "\n";
    }
}

/**
 * A CSS custom property and the design token it represents.
 */
export interface CssTokenMapEntry {
    readonly customProperty: string;
    readonly path: TokenPath;
    readonly type: TokenType | undefined;
    readonly description: string | undefined;
    readonly source: string | undefined;
}

/**
 * The result of parsing a serialized CSS token map.
 */
export type CssTokenMapReadResult = CssTokenMapReadSuccess | CssTokenMapReadFailure;

/**
 * A successfully parsed CSS token map.
 */
export interface CssTokenMapReadSuccess {
    readonly ok: true;
    readonly map: CssTokenMap;
}

/**
 * A rejected CSS token map.
 */
export interface CssTokenMapReadFailure {
    readonly ok: false;
    readonly reason: string;
}

interface CssTokenMapJsonEntry {
    readonly path: string;
    readonly type: TokenType | undefined;
    readonly description: string | undefined;
    readonly source: string | undefined;
}

const TOKEN_TYPES: readonly TokenType[] = [
    "color",
    "dimension",
    "fontFamily",
    "fontWeight",
    "number",
    "duration",
    "cubicBezier",
    "strokeStyle",
    "border",
    "transition",
    "shadow",
    "gradient",
    "typography",
];

function parseEntry(customProperty: string, value: unknown): CssTokenMapEntry {
    if (!isRecord(value)) {
        throw new Error(`Map entry "${customProperty}" must be a JSON object.`);
    }
    if (typeof value.path !== "string" || !isTokenPath(value.path)) {
        throw new Error(`Map entry "${customProperty}" has an invalid path.`);
    }
    if (value.type !== undefined && !isTokenType(value.type)) {
        throw new Error(`Map entry "${customProperty}" has an invalid token type.`);
    }
    if (value.description !== undefined && typeof value.description !== "string") {
        throw new Error(`Map entry "${customProperty}" has an invalid description.`);
    }
    if (value.source !== undefined && typeof value.source !== "string") {
        throw new Error(`Map entry "${customProperty}" has an invalid source.`);
    }

    return {
        customProperty,
        path: TokenPath.parse(value.path),
        type: value.type,
        description: value.description,
        source: value.source,
    };
}

function validateEntry(entry: CssTokenMapEntry): void {
    if (!isCustomProperty(entry.customProperty)) {
        throw new Error(`Invalid CSS custom property "${entry.customProperty}".`);
    }
    if (!isTokenPath(entry.path.toString())) {
        throw new Error(`Invalid token path "${entry.path}".`);
    }
}

function freezeEntry(entry: CssTokenMapEntry): CssTokenMapEntry {
    return Object.freeze({
        customProperty: entry.customProperty,
        path: TokenPath.of(...entry.path.segments()),
        type: entry.type,
        description: entry.description,
        source: entry.source,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCustomProperty(value: string): boolean {
    return /^--\S+$/.test(value);
}

function isTokenPath(value: string): boolean {
    return value.length > 0 && value.split(".").every((segment) => segment.length > 0);
}

function isTokenType(value: unknown): value is TokenType {
    return typeof value === "string" && TOKEN_TYPES.includes(value as TokenType);
}
