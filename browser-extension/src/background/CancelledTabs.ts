const KEY_PREFIX = "cancelledTab:";

/**
 * Tabs where the user cancelled the debugging bar.
 *
 * Kept in session storage, so the mark survives service worker restarts
 * and disappears when the browser closes.
 */
export class CancelledTabs {
    /**
     * Returns whether the user cancelled debugging of the tab.
     */
    async has(tabId: number): Promise<boolean> {
        const key: string = keyOf(tabId);
        // Storage holds whatever was written; only `true` marks a tab.
        const stored: Record<string, unknown> = await chrome.storage.session.get(key);
        return stored[key] === true;
    }

    /**
     * Marks the tab as cancelled.
     */
    async add(tabId: number): Promise<void> {
        await chrome.storage.session.set({ [keyOf(tabId)]: true });
    }

    /**
     * Clears the mark of the tab.
     */
    async remove(tabId: number): Promise<void> {
        await chrome.storage.session.remove(keyOf(tabId));
    }
}

function keyOf(tabId: number): string {
    return `${KEY_PREFIX}${tabId}`;
}
