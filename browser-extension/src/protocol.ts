import type { CssElementStyles } from "@design-token-kit/core/core/platforms/css/CssTokenTracer";

const PANEL_PORT_PREFIX = "panel";

const PANEL_PORT_OPENED = "opened";

const PANEL_PORT_RECONNECTED = "reconnected";

/** Port the panel keeps open while it is shown. */
export interface PanelPort {
    /** Inspected tab. */
    readonly tabId: number;

    /** Whether an open panel reconnects after the service worker restarted. */
    readonly reconnect: boolean;
}

/**
 * Returns the port name that carries the port description.
 */
export function toPanelPortName(port: PanelPort): string {
    return [PANEL_PORT_PREFIX, port.tabId, port.reconnect ? PANEL_PORT_RECONNECTED : PANEL_PORT_OPENED].join(":");
}

/**
 * Reads the port description from its name.
 *
 * @returns undefined when the port does not come from the panel.
 */
export function parsePanelPortName(name: string): PanelPort | undefined {
    const [prefix, tabId, state]: string[] = name.split(":");
    if (prefix !== PANEL_PORT_PREFIX || tabId === undefined || !/^\d+$/.test(tabId)) return undefined;
    if (state !== PANEL_PORT_OPENED && state !== PANEL_PORT_RECONNECTED) return undefined;
    return { tabId: Number(tabId), reconnect: state === PANEL_PORT_RECONNECTED };
}

/**
 * Global the panel sets to the selected element
 * so the service worker can find it.
 */
export const SELECTED_ELEMENT_GLOBAL = "__designTokenKitSelected";

/** Protocols of map URLs the service worker fetches. */
const MAP_URL_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Returns whether the text is an absolute http or https URL,
 * the only map URLs the service worker fetches.
 */
export function isMapUrl(text: string): boolean {
    const url: URL | undefined = parseUrl(text);
    return url !== undefined && MAP_URL_PROTOCOLS.has(url.protocol);
}

// URL.canParse needs Chrome 120; the extension supports Chrome 118.
function parseUrl(text: string): URL | undefined {
    try {
        return new URL(text);
    } catch (error) {
        if (error instanceof TypeError) return undefined;
        throw error;
    }
}

/** Request from the panel to the service worker. */
export type PanelRequest = InspectRequest | FetchMapRequest;

/** Asks for a snapshot of the element selected in the tab. */
export interface InspectRequest {
    readonly kind: "inspect";

    /** Inspected tab. */
    readonly tabId: number;
}

/** Asks to download a CSS token map. */
export interface FetchMapRequest {
    readonly kind: "fetch-map";

    /** Absolute URL of the map. */
    readonly url: string;
}

/** Everything the panel needs to trace the selected element. */
export interface ElementSnapshot {
    /** Declarations of the element and its ancestors, ordered by cascade. */
    readonly styles: CssElementStyles;

    /** Computed values by property name. */
    readonly computed: Readonly<Record<string, string>>;

    /** URL of the inspected page. */
    readonly documentUrl: string;
}

/**
 * Answer to an `inspect` request.
 *
 * The panel shows `reason` as is.
 */
export type InspectResponse =
    | { readonly ok: true; readonly snapshot: ElementSnapshot }
    | { readonly ok: false; readonly reason: string };

/**
 * Answer to a `fetch-map` request.
 *
 * The panel shows `reason` as is.
 */
export type FetchMapResponse =
    | { readonly ok: true; readonly json: string }
    | { readonly ok: false; readonly reason: string };
