import { CancelledTabs } from "#/browser-extension/background/CancelledTabs";
import { CdpSession } from "#/browser-extension/background/CdpSession";
import { ElementInspector } from "#/browser-extension/background/ElementInspector";
import { InspectError } from "#/browser-extension/background/InspectError";
import {
    isMapUrl,
    parsePanelPortName,
    type FetchMapRequest,
    type FetchMapResponse,
    type InspectResponse,
    type PanelPort,
    type PanelRequest,
} from "#/browser-extension/protocol";

// Service worker entry point and its ErrorBoundary:
// a failed request is answered with the error message as `reason`.

/** Answer to any panel request. */
type PanelResponse = InspectResponse | FetchMapResponse;

const DETACHED_BY_USER = "Debugger detached by user";

const INSPECT_FAILURE = "Cannot inspect the page";

const MAP_FAILURE = "CSS token map not loaded";

/** Time after which a map download is aborted. */
const MAP_TIMEOUT_MS = 10000;

const MAP_TIMEOUT_REASON = `${MAP_FAILURE}: no answer within ${MAP_TIMEOUT_MS / 1000} s`;

/**
 * Debugger sessions by tab id.
 *
 * Holds the attach promise, so that requests arriving while the debugger
 * attaches share one session.
 */
const sessions: Map<number, Promise<CdpSession>> = new Map();

/**
 * Tabs where the user cancelled the debugging bar.
 *
 * The debugger stays detached there until a new panel opens for the tab.
 */
const cancelledTabs: CancelledTabs = new CancelledTabs();

chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
    const panel: PanelPort | undefined = parsePanelPortName(port.name);
    if (panel === undefined) return;
    if (!panel.reconnect) void cancelledTabs.remove(panel.tabId);
    port.onDisconnect.addListener(() => void closeSession(panel.tabId));
});

chrome.debugger.onDetach.addListener((source: chrome.debugger.Debuggee, reason: string) => {
    if (source.tabId === undefined) return;
    if (reason === "canceled_by_user") void cancelledTabs.add(source.tabId);
    sessions.delete(source.tabId);
});

chrome.runtime.onMessage.addListener(
    (request: PanelRequest, _sender, sendResponse: (response: PanelResponse) => void): boolean => {
        const response: Promise<PanelResponse> | undefined = handle(request);
        if (response === undefined) return false;
        void response.then(sendResponse);
        return true;
    },
);

function handle(request: PanelRequest): Promise<PanelResponse> | undefined {
    switch (request.kind) {
        case "inspect":
            return answer(INSPECT_FAILURE, () => inspect(request.tabId));
        case "fetch-map":
            return answer(MAP_FAILURE, () => fetchMap(request));
        default:
            return ignore(request);
    }
}

async function answer(failure: string, action: () => Promise<PanelResponse>): Promise<PanelResponse> {
    try {
        return await action();
    } catch (error) {
        return { ok: false, reason: error instanceof InspectError ? error.message : `${failure}: ${messageOf(error)}` };
    }
}

// Messages of other senders are not ours to answer.
function ignore(_request: never): undefined {
    return undefined;
}

async function inspect(tabId: number): Promise<InspectResponse> {
    const session: CdpSession = await openSession(tabId);
    return { ok: true, snapshot: await new ElementInspector(session).inspect() };
}

async function fetchMap(request: FetchMapRequest): Promise<FetchMapResponse> {
    if (!isMapUrl(request.url)) {
        return { ok: false, reason: `${MAP_FAILURE}: ${request.url} is not an http(s) URL` };
    }
    try {
        return await downloadMap(new URL(request.url));
    } catch (error) {
        throw isTimeout(error) ? new InspectError(MAP_TIMEOUT_REASON) : error;
    }
}

async function downloadMap(url: URL): Promise<FetchMapResponse> {
    const response: Response = await fetch(url, mapRequestFor(url));
    if (!response.ok) return { ok: false, reason: `${MAP_FAILURE}: ${url.href}: HTTP ${response.status}` };
    return { ok: true, json: await response.text() };
}

// Fetch rejects with any value; the timeout signal rejects with a DOMException.
function isTimeout(error: unknown): boolean {
    return error instanceof DOMException && error.name === "TimeoutError";
}

/**
 * Sends cookies, because the user entered the map URL and it may need them,
 * but only over https, so they never travel in clear text.
 * Refuses redirects, so the cookies do not follow the request elsewhere.
 * A timeout aborts a download that hangs; its reason reaches the panel.
 */
function mapRequestFor(url: URL): RequestInit {
    return {
        credentials: url.protocol === "https:" ? "include" : "omit",
        redirect: "error",
        signal: AbortSignal.timeout(MAP_TIMEOUT_MS),
    };
}

async function openSession(tabId: number): Promise<CdpSession> {
    if (await cancelledTabs.has(tabId)) throw new InspectError(DETACHED_BY_USER);
    const existing: Promise<CdpSession> | undefined = sessions.get(tabId);
    if (existing !== undefined) return existing;
    const attaching: Promise<CdpSession> = CdpSession.attach(tabId);
    sessions.set(tabId, attaching);
    attaching.catch(() => dropSession(tabId, attaching));
    return await attaching;
}

function dropSession(tabId: number, failed: Promise<CdpSession>): void {
    if (sessions.get(tabId) === failed) sessions.delete(tabId);
}

async function closeSession(tabId: number): Promise<void> {
    const session: CdpSession | undefined = await takeSession(tabId);
    try {
        await session?.detach();
    } catch (error) {
        console.warn(`Cannot detach the debugger from tab ${tabId}: ${messageOf(error)}`);
    }
}

/**
 * Removes the tab's session from the registry.
 *
 * Resolves to undefined when attaching failed:
 * that error was already answered to the panel.
 */
async function takeSession(tabId: number): Promise<CdpSession | undefined> {
    const session: Promise<CdpSession> | undefined = sessions.get(tabId);
    sessions.delete(tabId);
    return await session?.catch(() => undefined);
}

// Errors cross the CDP and messaging boundaries, so their type is not known.
function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
