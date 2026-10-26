import type { ChainView, LinkView, PropertyView } from "#/browser-extension/panel/PanelModel";

/** Called with the title of the clicked link. */
type LinkClickHandler = (title: string) => void;

/**
 * Replaces the content of the container with the property views.
 *
 * @param onLinkClicked - Called with the link title, which the panel copies.
 */
export function renderProperties(
    container: HTMLElement,
    views: readonly PropertyView[],
    onLinkClicked: LinkClickHandler,
): void {
    container.replaceChildren(...views.map((view) => renderProperty(view, onLinkClicked)));
}

function renderProperty(view: PropertyView, onLinkClicked: LinkClickHandler): HTMLElement {
    const section: HTMLElement = element("section", "property");
    const name: HTMLElement = element("span", "property-name", view.property);
    section.append(name, " ", element("span", "property-origin", view.origin));
    if (view.computedValue !== "") section.append(" ", element("span", "computed-value", view.computedValue));
    if (view.rawValue !== undefined) {
        section.append(element("div", "value", view.rawValue), element("span", "raw-mark", "not from a token"));
    }
    view.chains.forEach((chain) => section.append(...renderChain(chain, onLinkClicked)));
    return section;
}

function renderChain(chain: ChainView, onLinkClicked: LinkClickHandler): HTMLElement[] {
    const lines: HTMLElement[] = chain.links.map((link, index) => renderLink(link, index, onLinkClicked));
    lines.push(element("div", "value", chain.ending));
    if (chain.description !== undefined) lines.push(element("div", "description", `"${chain.description}"`));
    return lines;
}

function renderLink(link: LinkView, index: number, onLinkClicked: LinkClickHandler): HTMLElement {
    const line: HTMLElement = element("div", "link", `${index === 0 ? "" : "-> "}${link.title}`);
    if (link.theme !== undefined) line.append(" ", element("span", "theme", `[${link.theme}]`));
    line.title = "Click to copy";
    line.addEventListener("click", () => onLinkClicked(link.title));
    return line;
}

function element(tag: string, className: string, text: string = ""): HTMLElement {
    const created: HTMLElement = document.createElement(tag);
    created.className = className;
    created.textContent = text;
    return created;
}
