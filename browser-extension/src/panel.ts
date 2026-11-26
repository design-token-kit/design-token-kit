import type {
    CssPropertyTraceDto,
    InspectorRequest,
    InspectorResponse,
    InspectorStatusMessage,
    InspectorTraceMessage,
} from "#/messages";
import "./panel.css";

const mapForm = requiredElement<HTMLFormElement>("map-form");
const mapUrlInput = requiredElement<HTMLInputElement>("map-url");
const pickElementButton = requiredElement<HTMLButtonElement>("pick-element");
const showLiteralsInput = requiredElement<HTMLInputElement>("show-literals");
const statusMessage = requiredElement<HTMLParagraphElement>("status-message");
const inspectedElement = requiredElement<HTMLParagraphElement>("inspected-element");
const mapWarning = requiredElement<HTMLParagraphElement>("map-warning");
const traceResults = requiredElement<HTMLElement>("trace-results");
let currentTraces: readonly CssPropertyTraceDto[] = [];

mapForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadMap();
});
pickElementButton.addEventListener("click", () => void pickElement());
showLiteralsInput.addEventListener("change", () => renderTraces(currentTraces));
chrome.runtime.onMessage.addListener((
    message: InspectorTraceMessage | InspectorTraceErrorMessage | InspectorStatusMessage,
) => {
    if (message.kind === "status") {
        setStatus(message.message);
        return;
    }
    if (message.kind === "trace") {
        currentTraces = message.traces;
        renderTraces(currentTraces);
        setInspectedElement(message.elementLabel);
        setMapWarning(message.mapWarning);
        setStatus("Element inspected.");
        return;
    }
    if (message.kind === "trace-error") setStatus(message.message);
});

async function loadMap(): Promise<void> {
    const mapUrl = mapUrlInput.value.trim();
    if (!mapUrl) {
        setStatus("The map URL is discovered automatically when possible.");
        return;
    }

    const response = await sendRequest({ kind: "load-map", mapUrl });
    setStatus(response.message);
}

async function pickElement(): Promise<void> {
    const response = await sendRequest({ kind: "pick-element" });
    setStatus(response.message);
}

async function sendRequest(request: InspectorRequest): Promise<InspectorResponse> {
    try {
        return await chrome.runtime.sendMessage(request) as InspectorResponse;
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : "The extension service worker is unavailable.";
        setStatus(message);
        return { ok: false, message };
    }
}

function renderTraces(traces: readonly CssPropertyTraceDto[]): void {
    const traceList = document.createElement("dl");
    traceList.className = "trace-list";
    const visibleTraces = showLiteralsInput.checked
        ? traces
        : traces.filter((trace) => trace.chains.length > 0);
    for (const trace of visibleTraces) {
        traceList.append(
            propertyTerm(trace),
            propertyDescription(trace),
        );
    }
    if (visibleTraces.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = showLiteralsInput.checked
            ? "No authored CSS properties found."
            : "No token references found. Enable literal properties to inspect all authored values.";
        traceResults.replaceChildren(emptyMessage);
        return;
    }
    traceResults.replaceChildren(traceList);
}

function propertyTerm(trace: CssPropertyTraceDto): HTMLElement {
    const term = document.createElement("dt");
    const heading = document.createElement("div");
    heading.className = "property-heading";
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = "Property:";
    const property = document.createElement("span");
    property.className = "field-value";
    property.textContent = trace.property;
    heading.append(label, document.createTextNode(" "), property);
    const source = trace.inheritedFrom === undefined
        ? trace.sourceSelector
        : `${trace.sourceSelector} on ${trace.inheritedFrom}`;
    term.append(heading, labeledValue("Source", source));
    return term;
}

function propertyDescription(trace: CssPropertyTraceDto): HTMLElement {
    const description = document.createElement("dd");
    if (trace.chains.length === 0) {
        description.append(
            labeledValue("Authored value", trace.authoredValue),
            ...computedValue(trace),
            labeledValue("Status", "No token reference"),
        );
        return description;
    }

    const chains = document.createElement("div");
    chains.className = "token-chain-list";
    trace.chains.forEach((chain, chainIndex) => {
        const chainElement = document.createElement("div");
        chainElement.className = "token-chain";
        const links = document.createElement("div");
        links.className = "token-link-list";
        const chainPaths = chain.links.map((link) => link.tokenPath ?? link.customProperty);
        const chainHeader = document.createElement("div");
        chainHeader.className = "chain-header";
        const chainLabel = document.createElement("span");
        chainLabel.className = "field-label";
        chainLabel.textContent = trace.chains.length > 1
            ? `Token chain ${chainIndex + 1}:`
            : "Token chain:";
        const copyChainButton = createCopyButton(
            chainPaths.join(" -> "),
            "Copy complete token chain",
        );
        chainHeader.append(chainLabel, copyChainButton);
        chainElement.append(chainHeader);
        chain.links.forEach((link) => {
            const linkElement = document.createElement("div");
            linkElement.className = "token-link";
            const path = link.tokenPath ?? link.customProperty;
            const pathRow = document.createElement("div");
            pathRow.className = "token-path-row";
            const pathElement = document.createElement("span");
            pathElement.className = "token-path";
            pathElement.textContent = path;
            pathRow.append(pathElement, createCopyButton(path, `Copy ${path}`));
            linkElement.append(pathRow);
            if (link.theme !== undefined) {
                linkElement.append(labeledValue("Theme", link.theme));
            }
            if (link.tokenDescription !== undefined) {
                linkElement.append(labeledValue("Description", link.tokenDescription));
            }
            links.append(linkElement);
        });
        chainElement.append(links, chainEnd(chain.end));
        chains.append(chainElement);
    });
    description.append(
        labeledValue("Authored value", trace.authoredValue),
        ...computedValue(trace),
        chains,
    );
    return description;
}

function computedValue(trace: CssPropertyTraceDto): readonly HTMLElement[] {
    return trace.computedValue === undefined
        ? []
        : [labeledValue("Computed value", trace.computedValue)];
}

function labeledValue(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "labeled-value";
    const labelElement = document.createElement("span");
    labelElement.className = "field-label";
    labelElement.textContent = `${label}:`;
    const valueElement = document.createElement("span");
    valueElement.className = "field-value";
    valueElement.textContent = value;
    row.append(labelElement, document.createTextNode(" "), valueElement);
    return row;
}

function createCopyButton(value: string, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.append(copyIcon());
    button.addEventListener("click", () => void copyTokenPath(value));
    return button;
}

function copyIcon(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
        "d",
        "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
    );
    svg.append(path);
    return svg;
}

async function copyTokenPath(path: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(path);
        setStatus(`Copied ${path}.`);
    } catch {
        setStatus("Could not copy the token path.");
    }
}

function chainEnd(end: CssPropertyTraceDto["chains"][number]["end"]): HTMLElement {
    const element = document.createElement("div");
    element.className = "chain-end";
    if (end.kind === "value") {
        element.append(labeledValue("Resolved value", end.value));
    } else {
        const value = end.fallback === undefined
            ? `${end.customProperty} is undefined`
            : `${end.customProperty} fallback: ${end.fallback}`;
        element.append(labeledValue("Chain end", value));
    }
    return element;
}

function setStatus(message: string): void {
    statusMessage.textContent = message;
}

function setInspectedElement(elementLabel: string): void {
    inspectedElement.textContent = `Element: ${elementLabel}`;
    inspectedElement.hidden = false;
}

function setMapWarning(message: string | undefined): void {
    mapWarning.textContent = message ?? "";
    mapWarning.hidden = message === undefined;
}

function requiredElement<TElement extends HTMLElement>(id: string): TElement {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing required element "${id}".`);
    }
    return element as TElement;
}

interface InspectorTraceErrorMessage {
    readonly kind: "trace-error";
    readonly tabId: number;
    readonly message: string;
}
