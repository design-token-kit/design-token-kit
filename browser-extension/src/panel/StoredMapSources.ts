import { toStoredMapSource, type StoredMapSource } from "#/browser-extension/panel/StoredMapSource";

const KEY_PREFIX = "mapSource:";

/**
 * CSS token maps the user provided, one per site origin.
 */
export class StoredMapSources {
    /**
     * Returns the source stored for the origin, or undefined when there is
     * none or the stored value is not a map source.
     */
    async find(origin: string): Promise<StoredMapSource | undefined> {
        const key: string = keyOf(origin);
        // Storage holds whatever was written; the value is checked below.
        const stored: Record<string, unknown> = await chrome.storage.local.get(key);
        return toStoredMapSource(stored[key]);
    }

    /**
     * Stores the source for the origin, replacing the previous one.
     */
    async save(origin: string, source: StoredMapSource): Promise<void> {
        await chrome.storage.local.set({ [keyOf(origin)]: source });
    }

    /**
     * Forgets the source of the origin.
     */
    async remove(origin: string): Promise<void> {
        await chrome.storage.local.remove(keyOf(origin));
    }
}

function keyOf(origin: string): string {
    return `${KEY_PREFIX}${origin}`;
}
