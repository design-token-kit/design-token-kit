/**
 * Requests sent from the Side Panel to the extension service worker.
 */
export type InspectorRequest =
    | {
        readonly kind: "load-map";
        readonly mapUrl: string;
    }
    | {
        readonly kind: "pick-element";
    };

/**
 * Responses returned by the extension service worker.
 */
export type InspectorResponse =
    | {
        readonly ok: true;
        readonly message: string;
    }
    | {
        readonly ok: false;
        readonly message: string;
    };

/**
 * A trace sent from the extension service worker after an element is selected.
 */
export interface InspectorTraceMessage {
    readonly kind: "trace";
    readonly tabId: number;
    readonly elementLabel: string;
    readonly mapWarning: string | undefined;
    readonly traces: readonly CssPropertyTraceDto[];
}

/**
 * A status update from the extension service worker.
 */
export interface InspectorStatusMessage {
    readonly kind: "status";
    readonly tabId: number;
    readonly message: string;
}

/**
 * A serializable CSS property trace for the Side Panel.
 */
export interface CssPropertyTraceDto {
    readonly property: string;
    readonly sourceSelector: string;
    readonly authoredValue: string;
    readonly computedValue: string | undefined;
    readonly inheritedFrom: string | undefined;
    readonly chains: readonly CssTokenChainDto[];
}

/**
 * A serializable custom property substitution chain.
 */
export interface CssTokenChainDto {
    readonly links: readonly CssTokenLinkDto[];
    readonly end: CssTokenChainEndDto;
}

/**
 * A serializable custom property substitution.
 */
export interface CssTokenLinkDto {
    readonly customProperty: string;
    readonly tokenPath: string | undefined;
    readonly tokenDescription: string | undefined;
    readonly layer: string | undefined;
    readonly theme: string | undefined;
}

/**
 * The final outcome of a substitution chain.
 */
export type CssTokenChainEndDto =
    | {
        readonly kind: "value";
        readonly value: string;
    }
    | {
        readonly kind: "undefined";
        readonly customProperty: string;
        readonly fallback: string | undefined;
    };
