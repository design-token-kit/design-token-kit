import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, type DOMWindow } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_HTML = readFileSync(path.join(__dirname, "..", "..", "ui.html"), "utf8");

/**
 * The plugin UI running in a simulated browser, with the messages it sends to
 * the plugin code captured instead of delivered.
 */
export interface LoadedUi {
    readonly window: DOMWindow;
    readonly document: Document;

    /** Plugin messages the UI has sent, oldest first. */
    readonly sent: Array<Record<string, unknown>>;

    /** Delivers a message from the plugin code to the UI. */
    receive(pluginMessage: Record<string, unknown>): void;

    /** Clicks the element matching a selector, failing when there is none. */
    click(selector: string): void;

    /** Returns the element matching a selector, failing when there is none. */
    get<T extends Element = HTMLElement>(selector: string): T;

    close(): void;
}

/**
 * Loads `ui.html` and runs its script.
 *
 * Inside Figma the UI posts to `parent`, which is the window itself here, so
 * `postMessage` is replaced before the script runs to record the messages.
 */
export function loadUi(): LoadedUi {
    const sent: Array<Record<string, unknown>> = [];
    const dom = new JSDOM(UI_HTML, {
        runScripts: "dangerously",
        beforeParse(window) {
            window.postMessage = ((message: { pluginMessage: Record<string, unknown> }) => {
                sent.push(message.pluginMessage);
            }) as DOMWindow["postMessage"];
        },
    });
    const { window } = dom;

    const get = <T extends Element = HTMLElement>(selector: string): T => {
        const element = window.document.querySelector<T>(selector);
        if (element === null) {
            throw new Error(`No element matches ${selector}`);
        }
        return element;
    };

    return {
        window,
        document: window.document,
        sent,
        receive(pluginMessage) {
            window.dispatchEvent(new window.MessageEvent("message", { data: { pluginMessage } }));
        },
        click(selector) {
            get(selector).click();
        },
        get,
        close() {
            window.close();
        },
    };
}

/** Returns the trimmed text of an element with whitespace collapsed. */
export function textOf(element: Element): string {
    return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}
