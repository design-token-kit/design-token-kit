import { TokenPath } from "#/core/model/TokenPath";
import { isTokenType, type TokenType } from "#/core/model/TokenType";

/**
 * Maps CSS custom properties produced by token-to-CSS conversion to the
 * tokens they were converted from.
 *
 * A custom property name cannot be turned back into a token path: conversion
 * joins path segments with dashes, so `--a-b-c` may come from `a.b-c` or
 * `a-b.c`. The map records the path explicitly, together with token metadata
 * that CSS does not keep.
 */
export class CssTokenMap {
    /** Version of the JSON representation that this class reads and writes. */
    static readonly VERSION = 1;

    readonly #entries: readonly CssTokenMapEntry[];
    readonly #entriesByCustomProperty: ReadonlyMap<string, CssTokenMapEntry>;

    /**
     * @param entries - One entry per custom property, in the order conversion
     *   emitted them.
     * @throws Error when two entries share a custom property.
     */
    constructor(entries: readonly CssTokenMapEntry[]) {
        this.#entries = [...entries];
        this.#entriesByCustomProperty = indexByCustomProperty(entries);
    }

    /**
     * Restores a map from its JSON representation.
     *
     * @param json - Serialized CSS token map.
     * @returns The map, or the reason it cannot be restored: malformed JSON,
     *   a format version other than {@link VERSION}, or an invalid entry.
     */
    static fromJson(json: string): CssTokenMapReadResult {
        try {
            return readDocument(JSON.parse(json));
        } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            return failure(`Malformed JSON: ${error.message}`);
        }
    }

    /**
     * Returns the entry for a custom property, or undefined when conversion
     * did not produce the property.
     *
     * @param customProperty - Full property name with the leading dashes, as
     *   it appears in a declaration or in `var()`, e.g. `--semantic-color-text`.
     */
    findByCustomProperty(customProperty: string): CssTokenMapEntry | undefined {
        return this.#entriesByCustomProperty.get(customProperty);
    }

    /** Returns all entries in the order conversion emitted their custom properties. */
    entries(): readonly CssTokenMapEntry[] {
        return this.#entries;
    }

    /** Returns the JSON representation of the map. */
    toJson(): string {
        const customProperties: Record<string, SerializedEntry> = Object.fromEntries(
            this.#entries.map((entry) => [entry.customProperty, serializeEntry(entry)]),
        );
        return `${JSON.stringify({ version: CssTokenMap.VERSION, customProperties }, null, 2)}\n`;
    }
}

/** A CSS custom property and the token it was converted from. */
export interface CssTokenMapEntry {
    /** CSS custom property name, e.g. `--semantic-color-text`. */
    readonly customProperty: string;

    /** Path of the token the property was converted from. */
    readonly path: TokenPath;

    /** Token type, or undefined when the token has none. */
    readonly type: TokenType | undefined;

    /** Token `$description`, or undefined when the token has none. */
    readonly description: string | undefined;

    /** Document that defines the token, taken from `Dtcg.source`. */
    readonly source: string | undefined;
}

/** Outcome of restoring a map from JSON: the map, or why it was rejected. */
export type CssTokenMapReadResult = CssTokenMapReadSuccess | CssTokenMapReadFailure;

/** The JSON was a valid representation and produced a map. */
export interface CssTokenMapReadSuccess {
    readonly ok: true;
    readonly map: CssTokenMap;
}

/** The JSON was rejected. */
export interface CssTokenMapReadFailure {
    readonly ok: false;

    /** Why the map cannot be restored. */
    readonly reason: string;
}

const CUSTOM_PROPERTY_PREFIX = "--";

interface SerializedEntry {
    readonly path: string;
    readonly type?: TokenType;
    readonly description?: string;
    readonly source?: string;
}

type EntryReadResult =
    | { readonly ok: true; readonly entry: CssTokenMapEntry }
    | CssTokenMapReadFailure;

function indexByCustomProperty(entries: readonly CssTokenMapEntry[]): ReadonlyMap<string, CssTokenMapEntry> {
    const index: Map<string, CssTokenMapEntry> = new Map();
    for (const entry of entries) {
        if (index.has(entry.customProperty)) {
            throw new Error(`Duplicate custom property in CSS token map: ${entry.customProperty}`);
        }
        index.set(entry.customProperty, entry);
    }
    return index;
}

function serializeEntry(entry: CssTokenMapEntry): SerializedEntry {
    return {
        path: entry.path.toString(),
        type: entry.type,
        description: entry.description,
        source: entry.source,
    };
}

// Parsed JSON has no static type, so the document is checked field by field.
function readDocument(document: unknown): CssTokenMapReadResult {
    if (!isRecord(document)) return failure("Expected a JSON object");
    if (document.version !== CssTokenMap.VERSION) {
        return failure(`Unsupported version ${JSON.stringify(document.version)}, expected ${CssTokenMap.VERSION}`);
    }
    if (!isRecord(document.customProperties)) return failure("Expected \"customProperties\" to be an object");

    const entries: CssTokenMapEntry[] = [];
    for (const [customProperty, value] of Object.entries(document.customProperties)) {
        const result: EntryReadResult = readEntry(customProperty, value);
        if (!result.ok) return failure(result.reason);
        entries.push(result.entry);
    }
    return { ok: true, map: new CssTokenMap(entries) };
}

// The entry value comes from parsed JSON and has no static type.
function readEntry(customProperty: string, value: unknown): EntryReadResult {
    const where = `Entry "${customProperty}"`;
    if (!customProperty.startsWith(CUSTOM_PROPERTY_PREFIX)) {
        return failure(`${where}: name must start with "${CUSTOM_PROPERTY_PREFIX}"`);
    }
    if (!isRecord(value)) return failure(`${where}: expected an object`);

    const { path, type, description, source } = value;
    if (!isString(path) || path === "") return failure(`${where}: "path" must be a non-empty string`);
    if (!isOptional(type, isTokenType)) {
        return failure(`${where}: unknown "type" ${JSON.stringify(type)}`);
    }
    if (!isOptional(description, isString)) return failure(`${where}: "description" must be a string`);
    if (!isOptional(source, isString)) return failure(`${where}: "source" must be a string`);

    return { ok: true, entry: { customProperty, path: TokenPath.parse(path), type, description, source } };
}

function failure(reason: string): CssTokenMapReadFailure {
    return { ok: false, reason };
}

// Narrows parsed JSON, whose type is unknown by nature.
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isOptional<TValue>(value: unknown, guard: (value: unknown) => value is TValue): value is TValue | undefined {
    return value === undefined || guard(value);
}
