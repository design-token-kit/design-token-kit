import type { SrgbColor } from "#/core/audit/color/SrgbColor";

/**
 * A design property that can be bound to a token.
 */
export type UsageProperty = "fill" | "stroke" | "corner-radius" | "gap" | "padding" | "font-size";

/**
 * The value a property renders with: a color, or a dimension in px.
 */
export type UsageValue =
    | { readonly type: "color"; readonly color: SrgbColor }
    | { readonly type: "dimension"; readonly px: number };

/**
 * What a property is bound to: a variable or a style.
 */
export interface TokenBinding {
    readonly kind: "variable" | "style";

    /** Name of the variable or style, e.g. `semantic/text/primary`. */
    readonly name: string;

    /** Token layer the name declares, e.g. `primitive`; `undefined` when it declares none. */
    readonly layer?: string;
}

/**
 * One property of a design element, such as the fill of a Figma rectangle, to
 * audit for token usage, independent of where it comes from.
 */
export interface UsageSample {
    /** Stable identifier of the property, e.g. `12:34#fill`. */
    readonly id: string;

    /** What the sample is, as shown to the user, e.g. `Card`. */
    readonly label: string;

    readonly property: UsageProperty;

    /** Which part of the property, e.g. `top` for one side of the padding. */
    readonly part?: string;

    /** The value the property renders with. */
    readonly value: UsageValue;

    /** The token the property is bound to; `undefined` for a hard-coded value. */
    readonly binding?: TokenBinding;

    /** Effective Figma variable modes for this property, when they are known. */
    readonly variableModes?: Readonly<Record<string, string>>;
}

/**
 * A token a hard-coded value could be replaced with.
 */
export interface TokenCandidate {
    readonly kind: "variable" | "style";

    /** Name of the variable or style, as shown to the user. */
    readonly name: string;

    /** Token layer the name declares; `undefined` when it declares none. */
    readonly layer?: string;

    /** Resolved value for the candidate's mode context. */
    readonly value: UsageValue;

    /** Properties the token is meant for; `undefined` for any property of its value type. */
    readonly properties?: readonly UsageProperty[];

    /** Effective Figma variable modes used to resolve this candidate. */
    readonly variableModes?: Readonly<Record<string, string>>;
}
