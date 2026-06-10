import { TokenReference } from "#/core/model/TokenReference";

/**
 * Units supported by dimension tokens.
 * - `px` - idealized pixel (equivalent to dp on Android, pt on iOS)
 * - `rem` - multiple of the system's default font size
 *
 * @see https://tr.designtokens.org/format/#dimension
 */
export type DimensionUnit = "px" | "rem";

/**
 * Represents a distance value with a unit.
 *
 * @see https://tr.designtokens.org/format/#dimension
 */
export class DimensionValue {
    readonly value: number;
    readonly unit: DimensionUnit;

    constructor(value: number, unit: DimensionUnit) {
        this.value = value;
        this.unit = unit;
    }

    toString(): string {
        return `${this.value}${this.unit}`;
    }
}

/** A dimension value or a reference to another dimension token. */
export type DimensionOrReference = DimensionValue | TokenReference;
