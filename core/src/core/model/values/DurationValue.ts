import { TokenReference } from "#/core/model/TokenReference";

/**
 * Time units supported by duration tokens.
 *
 * @see https://tr.designtokens.org/format/#duration
 */
export type DurationUnit = "ms" | "s";

/**
 * Represents an animation or transition duration.
 *
 * @see https://tr.designtokens.org/format/#duration
 */
export class DurationValue {
    readonly value: number | TokenReference;
    readonly unit: DurationUnit | TokenReference;

    constructor(value: number | TokenReference, unit: DurationUnit | TokenReference) {
        this.value = value;
        this.unit = unit;
    }

    /** Returns the duration normalized to milliseconds. */
    toMs(): number {
        if (this.value instanceof TokenReference || this.unit instanceof TokenReference) {
            throw new Error("Cannot convert a duration containing a property reference.");
        }
        return this.unit === "ms" ? this.value : this.value * 1000;
    }

    toString(): string {
        if (this.value instanceof TokenReference || this.unit instanceof TokenReference) {
            throw new Error("Cannot stringify a duration containing a property reference.");
        }
        return `${this.value}${this.unit}`;
    }
}

/** Returns true when a duration has no unresolved property references. */
export function isConcreteDurationValue(
    value: DurationValue,
): value is DurationValue & { readonly value: number; readonly unit: DurationUnit } {
    return typeof value.value === "number" && typeof value.unit === "string";
}

/** A duration value or a reference to another duration token. */
export type DurationOrReference = DurationValue | TokenReference;
