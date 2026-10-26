const PROTOCOL_VERSION = "1.3";

/**
 * Debugger connection to one tab.
 */
export class CdpSession {
    readonly #target: chrome.debugger.Debuggee;

    private constructor(tabId: number) {
        this.#target = { tabId };
    }

    /**
     * Attaches to the tab and enables the DOM and CSS domains.
     *
     * Chrome shows its debugging bar while the session is attached.
     * The CSS domain must be enabled for `CSS.getMatchedStylesForNode`.
     * When enabling fails, the session detaches before the error propagates.
     */
    static async attach(tabId: number): Promise<CdpSession> {
        const session = new CdpSession(tabId);
        await chrome.debugger.attach(session.#target, PROTOCOL_VERSION);
        try {
            await session.send("DOM.enable");
            await session.send("CSS.enable");
        } catch (error) {
            await session.#detachKeepingError();
            throw error;
        }
        return session;
    }

    /**
     * Sends a CDP command and returns its result.
     */
    async send<TResult>(method: string, params?: object): Promise<TResult> {
        return await chrome.debugger.sendCommand(this.#target, method, params) as TResult;
    }

    /**
     * Detaches from the tab; the debugging bar disappears.
     */
    async detach(): Promise<void> {
        await chrome.debugger.detach(this.#target);
    }

    // A detach failure is only logged, so the enable error that caused the
    // detach reaches the caller.
    async #detachKeepingError(): Promise<void> {
        try {
            await this.detach();
        } catch (error) {
            console.warn(`Cannot detach the debugger from tab ${this.#target.tabId}`, error);
        }
    }
}
