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
 * Default `rem` base in pixels, matching the CSS root font size.
 */
export const DEFAULT_REM_BASE = 16;

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

    /**
     * Returns the dimension normalized to pixels, expanding `rem` against the
     * given base.
     *
     * @remarks
     * Platforms without a `rem` unit, such as Android and SwiftUI, need an
     * absolute magnitude. Unlike `DurationValue.toMs`, the conversion
     * factor is not fixed: `rem` is a multiple of the consuming system's root
     * font size, so the base is supplied by the caller.
     *
     * @param base - Pixel value of one `rem`.
     */
    toPixels(base: number = DEFAULT_REM_BASE): number {
        return this.unit === "rem" ? this.value * base : this.value;
    }

    toString(): string {
        return `${this.value}${this.unit}`;
    }
}

/** A dimension value or a reference to another dimension token. */
export type DimensionOrReference = DimensionValue | TokenReference;
