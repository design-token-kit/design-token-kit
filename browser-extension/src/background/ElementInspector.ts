import type { CssElementStyles } from "@design-token-kit/core/core/platforms/css/CssTokenTracer";
import type { CdpSession } from "#/browser-extension/background/CdpSession";
import { InspectError } from "#/browser-extension/background/InspectError";
import { toElementStyles, type ElementLabels } from "#/browser-extension/cdp/CdpStylesConverter";
import type { CdpMatchedStyles } from "#/browser-extension/cdp/CdpTypes";
import { SELECTED_ELEMENT_GLOBAL, type ElementSnapshot } from "#/browser-extension/protocol";

/**
 * Takes a snapshot of the element the panel marked as selected.
 *
 * The panel stores the element in a page global, because the DevTools
 * selection (`$0`) is not visible to the extension's own debugger session.
 */
export class ElementInspector {
    readonly #session: CdpSession;

    constructor(session: CdpSession) {
        this.#session = session;
    }

    /**
     * Returns the styles and computed values of the selected element.
     *
     * Releases the page objects it referenced before returning.
     *
     * @throws InspectError when no element is selected.
     */
    async inspect(): Promise<ElementSnapshot> {
        try {
            return await this.#snapshot();
        } finally {
            await this.#releaseObjects();
        }
    }

    // A release failure is only logged, so the snapshot or the error of the
    // inspection reaches the caller.
    async #releaseObjects(): Promise<void> {
        try {
            await this.#session.send("Runtime.releaseObjectGroup", { objectGroup: OBJECT_GROUP });
        } catch (error) {
            console.warn("Cannot release the inspected page objects", error);
        }
    }

    async #snapshot(): Promise<ElementSnapshot> {
        const objectId: string = await this.#selectedElementObjectId();
        const matched: CdpMatchedStyles = await this.#matchedStyles(objectId);
        const labels: ElementLabels = await this.#callOnElement<ElementLabels>(objectId, LABELS_FUNCTION);
        const styles: CssElementStyles = toElementStyles(matched, labels);
        const computed: Record<string, string> = await this.#callOnElement<Record<string, string>>(
            objectId,
            COMPUTED_FUNCTION,
            [propertiesOf(styles)],
        );
        const documentUrl: string = await this.#evaluate<string>("location.href");
        return { styles, computed, documentUrl };
    }

    async #selectedElementObjectId(): Promise<string> {
        const result: RuntimeResult = await this.#run("Runtime.evaluate", {
            expression: TAKE_SELECTED_ELEMENT,
        });
        if (result.result.objectId === undefined) throw new InspectError("Select an element");
        return result.result.objectId;
    }

    async #matchedStyles(objectId: string): Promise<CdpMatchedStyles> {
        await this.#session.send("DOM.getDocument", { depth: 0 });
        const node: DomRequestNodeResult = await this.#session.send<DomRequestNodeResult>("DOM.requestNode", {
            objectId,
        });
        const nodeId: number = node.nodeId;
        return await this.#session.send<CdpMatchedStyles>("CSS.getMatchedStylesForNode", { nodeId });
    }

    async #callOnElement<TResult>(
        objectId: string,
        functionDeclaration: string,
        args: readonly CallArgument[] = [],
    ): Promise<TResult> {
        const result: RuntimeResult = await this.#run("Runtime.callFunctionOn", {
            objectId,
            functionDeclaration,
            arguments: args.map((value) => ({ value })),
            returnByValue: true,
        });
        return result.result.value as TResult;
    }

    async #evaluate<TResult>(expression: string): Promise<TResult> {
        const result: RuntimeResult = await this.#run("Runtime.evaluate", { expression, returnByValue: true });
        return result.result.value as TResult;
    }

    async #run(method: string, params: object): Promise<RuntimeResult> {
        const result: RuntimeResult = await this.#session.send<RuntimeResult>(method, {
            ...params,
            objectGroup: OBJECT_GROUP,
        });
        if (result.exceptionDetails !== undefined) {
            throw new Error(`${method} failed in the page: ${result.exceptionDetails.text}`);
        }
        return result;
    }
}

/** Group of the page objects one inspection references. */
const OBJECT_GROUP = "design-token-kit";

// Runs in the page: takes the element the panel marked and clears the global,
// so the page keeps no reference to it.
const TAKE_SELECTED_ELEMENT = `(() => {
    const element = window.${SELECTED_ELEMENT_GLOBAL};
    delete window.${SELECTED_ELEMENT_GLOBAL};
    return element;
})()`;

/** Argument passed by value to a function that runs in the page. */
type CallArgument = string | readonly string[];

/** Result of `DOM.requestNode`. */
interface DomRequestNodeResult {
    readonly nodeId: number;
}

/** Result of `Runtime.evaluate` and `Runtime.callFunctionOn`. */
interface RuntimeResult {
    readonly result: {
        readonly objectId?: string;

        // CDP returns any JSON value here; the caller knows the shape it asked for.
        readonly value?: unknown;
    };
    readonly exceptionDetails?: { readonly text: string };
}

// Runs in the page: labels the element and its ancestors.
// The order must match `inherited` of CSS.getMatchedStylesForNode, which walks
// flat-tree ancestors: a slotted element continues to its assigned slot, and
// the top element of a shadow tree continues to the shadow host.
// `parentOf` follows the same steps: assignedSlot, parentElement, host.
const LABELS_FUNCTION = `function () {
    const label = (element) => element.localName
        + (element.id ? "#" + element.id : "")
        + (element.classList.length > 0 ? "." + element.classList[0] : "");
    const parentOf = (element) => element.assignedSlot ?? element.parentElement ?? element.parentNode?.host ?? null;
    const ancestors = [];
    for (let current = parentOf(this); current !== null; current = parentOf(current)) {
        ancestors.push(label(current));
    }
    return { element: label(this), ancestors };
}`;

// Runs in the page: reads computed values, shorthands included.
const COMPUTED_FUNCTION = `function (properties) {
    const computed = getComputedStyle(this);
    return Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]));
}`;

function propertiesOf(styles: CssElementStyles): string[] {
    const properties: Set<string> = new Set();
    for (let current: CssElementStyles | undefined = styles; current !== undefined; current = current.parent) {
        current.declarations.forEach((declaration) => properties.add(declaration.property));
    }
    return [...properties];
}
