/**
 * CSS token map the user provided for a site origin.
 *
 * A file is stored with its content, because the panel cannot read the file
 * again later.
 * A URL is stored as is and fetched on every load of the panel.
 */
export type StoredMapSource = StoredMapFile | StoredMapUrl;

/** Map chosen from a local file. */
export interface StoredMapFile {
    readonly kind: "file";

    /** Name of the chosen file, without a directory. */
    readonly name: string;

    /** Content of the file, a serialized CSS token map. */
    readonly json: string;
}

/** Map downloaded from a URL. */
export interface StoredMapUrl {
    readonly kind: "url";

    /** Absolute URL of the map. */
    readonly url: string;
}

/**
 * Reads a map source from a value kept in storage.
 *
 * @param value - Stored value; storage is untyped, so any value may come.
 * @returns undefined when the value is not a map source.
 */
export function toStoredMapSource(value: unknown): StoredMapSource | undefined {
    if (!isRecord(value)) return undefined;
    if (value.kind === "file") return toStoredMapFile(value);
    if (value.kind === "url") return toStoredMapUrl(value);
    return undefined;
}

/**
 * Returns the text that names the source to the user:
 * the file name or the URL.
 */
export function mapSourceLabel(source: StoredMapSource): string {
    return source.kind === "file" ? source.name : source.url;
}

/**
 * Returns a key that equals for sources giving the same map:
 * the URL for a URL source, the content for a file source.
 */
export function mapSourceKey(source: StoredMapSource): string {
    return source.kind === "file" ? `file:${source.json}` : `url:${source.url}`;
}

// Properties of a stored object are untyped until checked.
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null;
}

function toStoredMapFile(value: Readonly<Record<string, unknown>>): StoredMapFile | undefined {
    const { name, json }: Readonly<Record<string, unknown>> = value;
    if (!isNonEmptyString(name) || typeof json !== "string") return undefined;
    return { kind: "file", name, json };
}

function toStoredMapUrl(value: Readonly<Record<string, unknown>>): StoredMapUrl | undefined {
    const { url }: Readonly<Record<string, unknown>> = value;
    return isNonEmptyString(url) ? { kind: "url", url } : undefined;
}

// Callers pass untyped stored properties.
function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value !== "";
}
