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
    readonly value: number;
    readonly unit: DurationUnit;

    constructor(value: number, unit: DurationUnit) {
        this.value = value;
        this.unit = unit;
    }

    /** Returns the duration normalized to milliseconds. */
    toMs(): number {
        return this.unit === "ms" ? this.value : this.value * 1000;
    }

    toString(): string {
        return `${this.value}${this.unit}`;
    }
}

/** A duration value or a reference to another duration token. */
export type DurationOrReference = DurationValue | TokenReference;
