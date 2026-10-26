import { TokenLayers } from "@design-token-kit/core/core/check/TokenLayers";
import { CssTokenMap, type CssTokenMapReadResult } from "@design-token-kit/core/core/platforms/css/CssTokenMap";
import { CssTokenTracer, type CssPropertyTrace } from "@design-token-kit/core/core/platforms/css/CssTokenTracer";
import { toPropertyViews } from "#/browser-extension/panel/PanelModel";
import {
    mapSourceKey,
    mapSourceLabel,
    type StoredMapSource,
} from "#/browser-extension/panel/StoredMapSource";
import { StoredMapSources } from "#/browser-extension/panel/StoredMapSources";
import { renderProperties } from "#/browser-extension/panel/renderPanel";
import {
    isMapUrl,
    SELECTED_ELEMENT_GLOBAL,
    toPanelPortName,
    type ElementSnapshot,
    type FetchMapResponse,
    type InspectResponse,
    type PanelRequest,
} from "#/browser-extension/protocol";

// Sidebar pane entry point and its ErrorBoundary:
// every failure ends up in the status line.

/** Map the panel read from a source, or the reason it could not. */
interface MapReading {
    readonly map: CssTokenMap | undefined;
    readonly status: string;
}

/** Map the panel loaded, or tried to load, with the key of its source. */
interface LoadedMap extends MapReading {
    readonly sourceKey: string;
}

/**
 * Changes the map source of a site origin.
 *
 * @returns whether the source changed.
 */
type SourceChange = (origin: string) => Promise<boolean>;

/**
 * What `$0` is in the inspected window:
 * an element of the top frame, a node of another frame, or nothing.
 */
type Selection = "element" | "foreign" | "none";

/** Why `chrome.devtools.inspectedWindow.eval` failed. */
type EvaluationFailure = chrome.devtools.inspectedWindow.EvaluationExceptionInfo;

const tabId: number = chrome.devtools.inspectedWindow.tabId;
const mapSources: StoredMapSources = new StoredMapSources();
const statusLine: HTMLParagraphElement = requireElement<HTMLParagraphElement>("status");
const propertiesContainer: HTMLElement = requireElement<HTMLElement>("properties");
const mapForm: HTMLFormElement = requireElement<HTMLFormElement>("map-form");
const sourceUrlInput: HTMLInputElement = requireElement<HTMLInputElement>("map-url");
const mapFileInput: HTMLInputElement = requireElement<HTMLInputElement>("map-file");
const removeMapButton: HTMLButtonElement = requireElement<HTMLButtonElement>("map-remove");

/**
 * Port that tells the service worker the panel is open.
 *
 * The worker detaches the debugger when the port closes.
 * A restarted worker closes the port too, so the panel opens a new one.
 */
let workerPort: chrome.runtime.Port | undefined;

/** Delay before the next reconnect; grows while connecting fails. */
let reconnectDelay: number = 0;

const MIN_RECONNECT_DELAY = 1000;

const MAX_RECONNECT_DELAY = 30000;

/**
 * Largest map file the pane accepts.
 * Extension storage holds about 10 MB for all sites together.
 */
const MAX_MAP_FILE_MB = 5;

const MAX_MAP_FILE_BYTES = MAX_MAP_FILE_MB * 1024 * 1024;

/** Number of the latest requested refresh; older ones are dropped. */
let latestRefresh: number = 0;

/**
 * Refreshes and source changes run one after another,
 * so the map is read once.
 */
let refreshQueue: Promise<void> = Promise.resolve();

let loadedMap: LoadedMap | undefined;
let currentOrigin: string | undefined;

connectToWorker(false);
chrome.devtools.panels.elements.onSelectionChanged.addListener(scheduleRefresh);
mapForm.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault();
    scheduleSourceChange(saveMapUrl(sourceUrlInput.value.trim()));
});
mapFileInput.addEventListener("change", onMapFileChosen);
removeMapButton.addEventListener("click", onRemoveClicked);
chrome.devtools.network.onNavigated.addListener(onNavigated);
scheduleRefresh();

function connectToWorker(reconnect: boolean): void {
    workerPort = chrome.runtime.connect({ name: toPanelPortName({ tabId, reconnect }) });
    workerPort.onDisconnect.addListener(onWorkerDisconnect);
}

// A worker restart closes the port cleanly; lastError means connecting failed.
function onWorkerDisconnect(): void {
    reconnectDelay = chrome.runtime.lastError === undefined
        ? 0
        : Math.min(Math.max(reconnectDelay * 2, MIN_RECONNECT_DELAY), MAX_RECONNECT_DELAY);
    setTimeout(() => connectToWorker(true), reconnectDelay);
}

/** A new page may have another origin, so its map is looked up again. */
function onNavigated(): void {
    refreshQueue = refreshQueue.then(() => {
        loadedMap = undefined;
        currentOrigin = undefined;
        showMapSource(undefined);
    });
    scheduleRefresh();
}

function scheduleRefresh(): void {
    const refresh: number = ++latestRefresh;
    refreshQueue = refreshQueue.then(() => runRefresh(refresh));
}

/** Clears the input, so choosing the same file again is reported too. */
function onMapFileChosen(): void {
    const file: File | undefined = mapFileInput.files?.[0];
    mapFileInput.value = "";
    if (file !== undefined) scheduleSourceChange(saveMapFile(file));
}

/** Removing disables the button, so focus moves to the cleared URL input. */
function onRemoveClicked(): void {
    sourceUrlInput.value = "";
    sourceUrlInput.focus();
    scheduleSourceChange(removeMapSource);
}

function scheduleSourceChange(change: SourceChange): void {
    refreshQueue = refreshQueue.then(() => applySourceChange(change));
}

async function runRefresh(refresh: number): Promise<void> {
    if (isStale(refresh)) return;
    try {
        await inspectSelection(refresh);
    } catch (error) {
        showProblem(`Inspector failed: ${messageOf(error)}`);
    }
}

/**
 * Changes the source of the inspected site,
 * so an element must be inspected first.
 * Reads the origin when the change runs, after earlier navigations.
 */
async function applySourceChange(change: SourceChange): Promise<void> {
    if (currentOrigin === undefined) {
        showStatus("Select an element first");
        return;
    }
    try {
        if (!await change(currentOrigin)) return;
        loadedMap = undefined;
        scheduleRefresh();
    } catch (error) {
        showProblem(`Cannot change the CSS token map: ${messageOf(error)}`);
    }
}

function saveMapUrl(url: string): SourceChange {
    return async (origin: string): Promise<boolean> => {
        if (!isMapUrl(url)) {
            showStatus(`CSS token map URL must be an absolute http(s) URL: ${url}`);
            return false;
        }
        await mapSources.save(origin, { kind: "url", url });
        return true;
    };
}

/**
 * Stores the file content,
 * because the panel cannot read the file again later.
 */
function saveMapFile(file: File): SourceChange {
    return async (origin: string): Promise<boolean> => {
        if (file.size > MAX_MAP_FILE_BYTES) {
            showStatus(rejectionOf(`${file.name} is larger than ${MAX_MAP_FILE_MB} MB`));
            return false;
        }
        const json: string = await file.text();
        const result: CssTokenMapReadResult = CssTokenMap.fromJson(json);
        if (!result.ok) {
            showStatus(rejectionOf(result.reason));
            return false;
        }
        await mapSources.save(origin, { kind: "file", name: file.name, json });
        return true;
    };
}

async function removeMapSource(origin: string): Promise<boolean> {
    await mapSources.remove(origin);
    return true;
}

async function inspectSelection(refresh: number): Promise<void> {
    const selection: Selection = await markSelectedElement();
    if (selection !== "element") {
        showProblem(selection === "foreign"
            ? "Select an element in the top frame; frames are not supported"
            : "Select an element");
        return;
    }
    const response: InspectResponse = await request<InspectResponse>({ kind: "inspect", tabId });
    if (isStale(refresh)) return;
    if (!response.ok) {
        showProblem(response.reason);
        return;
    }
    await show(response.snapshot, refresh);
}

async function show(snapshot: ElementSnapshot, refresh: number): Promise<void> {
    currentOrigin = new URL(snapshot.documentUrl).origin;
    const source: StoredMapSource | undefined = await mapSources.find(currentOrigin);
    showMapSource(source);
    await loadMap(source);
    if (isStale(refresh)) return;
    const tracer: CssTokenTracer = new CssTokenTracer(loadedMap?.map, TokenLayers.default());
    const traces: CssPropertyTrace[] = tracer.trace(snapshot.styles, new Map(Object.entries(snapshot.computed)));
    showStatus(loadedMap?.status ?? "No CSS token map: showing custom property names");
    renderProperties(propertiesContainer, toPropertyViews(traces), copyToClipboard);
}

async function loadMap(source: StoredMapSource | undefined): Promise<void> {
    if (source === undefined) {
        loadedMap = undefined;
        return;
    }
    const sourceKey: string = mapSourceKey(source);
    // Only a parsed map is reused; a failure is retried on the next refresh.
    if (loadedMap?.map !== undefined && loadedMap.sourceKey === sourceKey) return;
    loadedMap = { sourceKey, ...await readMap(source) };
}

async function readMap(source: StoredMapSource): Promise<MapReading> {
    const response: FetchMapResponse = await readMapJson(source);
    return response.ok
        ? parseMap(mapSourceLabel(source), response.json)
        : { map: undefined, status: response.reason };
}

/**
 * A file source keeps its content;
 * a URL source is fetched by the service worker.
 */
async function readMapJson(source: StoredMapSource): Promise<FetchMapResponse> {
    if (source.kind === "file") return { ok: true, json: source.json };
    return await request<FetchMapResponse>({ kind: "fetch-map", url: source.url });
}

function parseMap(label: string, json: string): MapReading {
    const result: CssTokenMapReadResult = CssTokenMap.fromJson(json);
    return result.ok
        ? { map: result.map, status: `CSS token map: ${label}` }
        : { map: undefined, status: rejectionOf(result.reason) };
}

function rejectionOf(reason: string): string {
    return `CSS token map rejected: ${reason}`;
}

function isStale(refresh: number): boolean {
    return refresh !== latestRefresh;
}

function markSelectedElement(): Promise<Selection> {
    const expression: string = `$0 instanceof Element ? (window.${SELECTED_ELEMENT_GLOBAL} = $0, "element")
        : $0?.nodeType === Node.ELEMENT_NODE ? "foreign" : "none"`;
    return new Promise((resolve: (selection: Selection) => void, reject: (error: Error) => void) => {
        chrome.devtools.inspectedWindow.eval<Selection>(
            expression,
            (selection: Selection | undefined, failure: EvaluationFailure | undefined) => {
                if (failure === undefined) resolve(selection ?? "none");
                else reject(new Error(`Cannot read the selection: ${describeFailure(failure)}`));
            },
        );
    });
}

function describeFailure(failure: EvaluationFailure): string {
    return failure.isException === true ? failure.value : failure.description;
}

function request<TResponse>(message: PanelRequest): Promise<TResponse> {
    return chrome.runtime.sendMessage<PanelRequest, TResponse>(message);
}

function showMapSource(source: StoredMapSource | undefined): void {
    const url: string = source?.kind === "url" ? source.url : "";
    if (document.activeElement !== sourceUrlInput) sourceUrlInput.value = url;
    removeMapButton.disabled = source === undefined;
}

/** Writes only a changed text, so screen readers do not repeat the status. */
function showStatus(text: string): void {
    if (statusLine.textContent !== text) statusLine.textContent = text;
}

function showProblem(text: string): void {
    showStatus(text);
    propertiesContainer.replaceChildren();
}

// Errors cross the messaging and page boundaries, so their type is not known.
function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function copyToClipboard(text: string): void {
    // DevTools frames do not grant the asynchronous clipboard API.
    const buffer: HTMLTextAreaElement = document.createElement("textarea");
    buffer.value = text;
    document.body.append(buffer);
    buffer.select();
    const copied: boolean = document.execCommand("copy");
    buffer.remove();
    showStatus(copied ? `Copied ${text}` : `Cannot copy ${text}`);
}

function requireElement<TElement extends HTMLElement>(id: string): TElement {
    const found: HTMLElement | null = document.getElementById(id);
    if (found === null) throw new Error(`panel.html has no #${id}`);
    return found as TElement;
}
