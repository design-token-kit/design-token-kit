import {
    CssTokenMap,
    CssTokenTracer,
    TokenLayers,
    type CssPropertyTrace,
} from "@design-token-kit/core/browser";
import {
    CdpStylesAdapter,
    type CdpComputedStyleProperty,
    type CdpCssProperty,
    type CdpInheritedStyle,
    type CdpMatchedStyles,
    type CdpStyle,
} from "#/CdpStylesAdapter";
import type {
    CssPropertyTraceDto,
    InspectorRequest,
    InspectorResponse,
    InspectorTraceMessage,
} from "#/messages";

const cdpStylesAdapter = new CdpStylesAdapter();
const tokenMapsByTab = new Map<number, CssTokenMap>();
const attachedTabIds = new Set<number>();
const tracingTabIds = new Set<number>();
const styleSheetUrls = new Map<string, string>();

void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isInspectorRequest(message)) return false;

    void handleRequest(message)
        .then(sendResponse)
        .catch((error: unknown) => sendResponse({
            ok: false,
            message: error instanceof Error ? error.message : "Unexpected inspector error.",
        } satisfies InspectorResponse));
    return true;
});

chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId !== undefined && method === "CSS.styleSheetAdded") {
        rememberStyleSheet(source.tabId, params as CdpStyleSheetAdded);
        return;
    }
    if (source.tabId === undefined || method !== "Overlay.inspectNodeRequested") return;

    const inspectedNode = params as CdpInspectedNode;
    if (inspectedNode.backendNodeId === undefined) return;
    if (tracingTabIds.has(source.tabId)) return;

    tracingTabIds.add(source.tabId);
    void sendStatus(source.tabId, "Element selected. Reading styles...");
    void traceSelectedNode(source.tabId, inspectedNode.backendNodeId);
});

chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId === undefined) return;
    attachedTabIds.delete(source.tabId);
    tracingTabIds.delete(source.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "loading") return;
    clearTabState(tabId);
    void detachDebugger(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId);
});

async function handleRequest(request: InspectorRequest): Promise<InspectorResponse> {
    const tab = await getActiveTab();
    if (request.kind === "load-map") {
        const mapUrl = await loadMap(tab.id, tab.url, request.mapUrl);
        return {
            ok: true,
            message: `Loaded token map from ${mapUrl}.`,
        };
    }

    await enableElementPicker(tab.id);
    await sendStatus(tab.id, "Picker is active. Click an element on the page.");
    return {
        ok: true,
        message: "Select an element on the page.",
    };
}

function isInspectorRequest(value: unknown): value is InspectorRequest {
    if (typeof value !== "object" || value === null) return false;
    const message = value as { readonly kind?: unknown };
    return message.kind === "load-map" || message.kind === "pick-element";
}

async function loadMap(tabId: number, pageUrl: string, requestedUrl: string): Promise<string> {
    const mapUrl = new URL(requestedUrl, pageUrl).href;
    await loadMapAtUrl(tabId, mapUrl);
    return mapUrl;
}

async function loadMapAtUrl(tabId: number, mapUrl: string): Promise<void> {
    const response = await fetch(mapUrl);
    if (!response.ok) {
        throw new InspectorRequestError(`Token map request failed with HTTP ${response.status}.`);
    }

    const result = CssTokenMap.fromJson(await response.text());
    if (!result.ok) {
        throw new InspectorRequestError(result.reason);
    }

    tokenMapsByTab.set(tabId, result.map);
}

async function getTokenMap(
    tabId: number,
    matchedStyles: CdpMatchedStyles,
): Promise<TokenMapLookup> {
    const loadedMap = tokenMapsByTab.get(tabId);
    if (loadedMap !== undefined) return { map: loadedMap };

    const locator = findMapLocator(matchedStyles);
    if (locator === undefined) {
        return {
            map: undefined,
            warning: "Token map was not found. Showing CSS variable names.",
        };
    }

    const tab = await chrome.tabs.get(tabId);
    if (tab.url === undefined) {
        return {
            map: undefined,
            warning: "Token map was not found. Showing CSS variable names.",
        };
    }
    const baseUrl = locator.styleSheetId === undefined
        ? tab.url
        : styleSheetUrls.get(styleSheetKey(tabId, locator.styleSheetId)) ?? tab.url;
    const mapUrl = new URL(locator.url, baseUrl).href;

    try {
        await loadMapAtUrl(tabId, mapUrl);
        return { map: tokenMapsByTab.get(tabId) };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Token map could not be loaded.";
        return {
            map: undefined,
            warning: `${message} Showing CSS variable names.`,
        };
    }
}

async function enableElementPicker(tabId: number): Promise<void> {
    await sendStatus(tabId, "Connecting to Chrome DevTools Protocol...");
    await attach(tabId);
    await sendCommand(tabId, "DOM.enable");
    await sendCommand(tabId, "DOM.getDocument", { depth: -1 });
    await sendCommand(tabId, "CSS.enable");
    await sendCommand(tabId, "Overlay.enable");
    await sendCommand(tabId, "Overlay.setInspectMode", {
        mode: "searchForNode",
        highlightConfig: {
            showInfo: true,
            contentColor: { r: 72, g: 133, b: 237, a: 0.25 },
            borderColor: { r: 26, g: 115, b: 232, a: 1 },
        },
    });
}

async function sendStatus(tabId: number, message: string): Promise<void> {
    await chrome.runtime.sendMessage({
        kind: "status",
        tabId,
        message,
    });
}

async function traceSelectedNode(tabId: number, backendNodeId: number): Promise<void> {
    try {
        const nodeIds = await sendCommand<CdpNodeIds>(tabId, "DOM.pushNodesByBackendIdsToFrontend", {
            backendNodeIds: [backendNodeId],
        });
        const nodeId = nodeIds.nodeIds?.[0];
        if (nodeId === undefined) {
            throw new InspectorRequestError("Chrome did not return the selected node.");
        }

        const [description, matchedStyles, computedStyles] = await Promise.all([
            sendCommand<CdpNodeDescription>(tabId, "DOM.describeNode", { nodeId }),
            sendCommand<CdpMatchedStyles>(tabId, "CSS.getMatchedStylesForNode", { nodeId }),
            sendCommand<CdpComputedStyles>(tabId, "CSS.getComputedStyleForNode", { nodeId }),
        ]);
        const ancestorLabels = await describeAncestorLabels(
            tabId,
            description.node?.parentId,
            matchedStyles.inherited?.length ?? 0,
        );
        const styles = cdpStylesAdapter.toElementStyles(
            nodeLabel(description),
            matchedStyles,
            ancestorLabels,
        );
        const computed = cdpStylesAdapter.toComputedValues(computedStyles.computedStyle ?? []);
        const tokenMap = await getTokenMap(tabId, matchedStyles);
        const traces = new CssTokenTracer(tokenMap.map, TokenLayers.default()).trace(styles, computed);

        const message: InspectorTraceMessage = {
            kind: "trace",
            tabId,
            elementLabel: nodeLabel(description),
            mapWarning: tokenMap.warning,
            traces: traces.map(toTraceDto),
        };
        await chrome.runtime.sendMessage(message);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to inspect the selected element.";
        await chrome.runtime.sendMessage({
            kind: "trace-error",
            tabId,
            message,
        });
    } finally {
        tracingTabIds.delete(tabId);
        await detachDebugger(tabId);
    }
}

async function attach(tabId: number): Promise<void> {
    if (attachedTabIds.has(tabId)) return;

    await chrome.debugger.attach({ tabId }, "1.3");
    attachedTabIds.add(tabId);
}

async function detachDebugger(tabId: number): Promise<void> {
    if (!attachedTabIds.has(tabId)) return;

    await chrome.debugger.sendCommand({ tabId }, "Overlay.setInspectMode", {
        mode: "none",
    }).catch(() => undefined);
    await chrome.debugger.detach({ tabId }).catch(() => undefined);
    attachedTabIds.delete(tabId);
}

async function sendCommand<TResponse>(
    tabId: number,
    method: string,
    commandParams?: object,
): Promise<TResponse> {
    return await chrome.debugger.sendCommand({ tabId }, method, commandParams) as TResponse;
}

async function getActiveTab(): Promise<chrome.tabs.Tab & { readonly id: number; readonly url: string }> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined || tab.url === undefined) {
        throw new InspectorRequestError("Open a regular web page before using the inspector.");
    }
    return tab as chrome.tabs.Tab & { readonly id: number; readonly url: string };
}

function nodeLabel(description: CdpNodeDescription): string {
    const name = description.node?.nodeName?.toLowerCase();
    return name === undefined ? "selected element" : name;
}

function rememberStyleSheet(tabId: number, event: CdpStyleSheetAdded): void {
    const header = event.header;
    if (header?.styleSheetId === undefined || header.sourceURL === undefined) return;
    styleSheetUrls.set(styleSheetKey(tabId, header.styleSheetId), header.sourceURL);
}

function clearTabState(tabId: number): void {
    tokenMapsByTab.delete(tabId);
    tracingTabIds.delete(tabId);
    const keyPrefix = `${tabId}:`;
    for (const key of styleSheetUrls.keys()) {
        if (key.startsWith(keyPrefix)) styleSheetUrls.delete(key);
    }
}

function styleSheetKey(tabId: number, styleSheetId: string): string {
    return `${tabId}:${styleSheetId}`;
}

function findMapLocator(styles: CdpMatchedStyles): CdpMapLocator | undefined {
    const styleGroups = [
        styles,
        ...(styles.inherited ?? []),
    ];
    for (const styleGroup of styleGroups) {
        const declaration = findMapDeclaration(styleGroup);
        if (declaration === undefined) continue;
        return {
            url: unquoteCssString(declaration.property.value),
            styleSheetId: declaration.styleSheetId,
        };
    }
    return undefined;
}

function findMapDeclaration(styles: CdpMatchedStyles | CdpInheritedStyle): CdpMapDeclaration | undefined {
    const candidates = cascadeStyles(styles)
        .map((style) => ({
            styleSheetId: style.styleSheetId,
            property: findWinningMapProperty(style),
        }))
        .filter((candidate): candidate is CdpMapDeclaration =>
            candidate.property?.value !== undefined,
        );
    const importantCandidate = candidates.find((candidate) => candidate.property.important === true);
    return importantCandidate ?? candidates[0];
}

function cascadeStyles(styles: CdpMatchedStyles | CdpInheritedStyle): CdpStyle[] {
    const candidates: CdpStyle[] = [];
    if (styles.inlineStyle !== undefined) candidates.push(styles.inlineStyle);
    for (const matchedRule of [...(styles.matchedCSSRules ?? [])].reverse()) {
        if (matchedRule.rule?.style === undefined || matchedRule.rule.origin === "user-agent") continue;
        candidates.push(matchedRule.rule.style);
    }
    return candidates;
}

function findWinningMapProperty(style: CdpStyle): CdpCssProperty | undefined {
    const properties = [...(style.cssProperties ?? [])]
        .filter((property) => property.name === "--dtokens-map" && property.disabled !== true)
        .reverse();
    const importantProperty = properties.find((property) => property.important === true);
    return importantProperty ?? properties[0];
}

function unquoteCssString(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 2) return trimmed;
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first !== "\"" && first !== "'") || first !== last) return trimmed;
    return trimmed.slice(1, -1);
}

async function describeAncestorLabels(
    tabId: number,
    firstParentId: number | undefined,
    count: number,
): Promise<string[]> {
    const labels: string[] = [];
    let parentId = firstParentId;
    while (parentId !== undefined && labels.length < count) {
        const description = await sendCommand<CdpNodeDescription>(tabId, "DOM.describeNode", {
            nodeId: parentId,
        });
        labels.push(nodeLabel(description));
        parentId = description.node?.parentId;
    }
    return labels;
}

function toTraceDto(trace: CssPropertyTrace): CssPropertyTraceDto {
    return {
        property: trace.property,
        sourceSelector: trace.declaration.selector,
        authoredValue: trace.declaration.value,
        computedValue: trace.computedValue,
        inheritedFrom: trace.inheritedFrom,
        chains: trace.chains.map((chain) => ({
            links: chain.links.map((link) => ({
                customProperty: link.customProperty,
                tokenPath: link.token?.path.toString(),
                tokenDescription: link.token?.description,
                layer: link.layer,
                theme: link.theme,
            })),
            end: chain.end,
        })),
    };
}

class InspectorRequestError extends Error {

    constructor(message: string) {
        super(message);
        this.name = "InspectorRequestError";
    }
}

interface CdpInspectedNode {
    readonly backendNodeId?: number;
}

interface CdpStyleSheetAdded {
    readonly header?: {
        readonly styleSheetId?: string;
        readonly sourceURL?: string;
    };
}

interface CdpMapLocator {
    readonly url: string;
    readonly styleSheetId: string | undefined;
}

interface CdpMapDeclaration {
    readonly property: {
        readonly value: string;
        readonly important?: boolean;
    };
    readonly styleSheetId: string | undefined;
}

interface TokenMapLookup {
    readonly map: CssTokenMap | undefined;
    readonly warning?: string;
}

interface CdpNodeIds {
    readonly nodeIds?: readonly number[];
}

interface CdpNodeDescription {
    readonly node?: {
        readonly nodeName?: string;
        readonly parentId?: number;
    };
}

interface CdpComputedStyles {
    readonly computedStyle?: readonly CdpComputedStyleProperty[];
}
