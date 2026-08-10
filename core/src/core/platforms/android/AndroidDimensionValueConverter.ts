import { DimensionValue } from "#/core/model/values/DimensionValue";

/**
 * Android dimension units.
 *
 * - `dp` - density-independent pixel, used for sizes
 * - `sp` - scale-independent pixel, used for font sizes
 *
 * @see https://developer.android.com/guide/topics/resources/more-resources#Dimension
 */
export type AndroidDimensionUnit = "dp" | "sp";

/**
 * Default `rem` base in pixels, matching the CSS root font size.
 */
const DEFAULT_REM_BASE = 16;

const MAX_FRACTION_DIGITS = 4;

/**
 * Converts DTCG dimension values to Android dimension literals.
 *
 * @remarks
 * Android has no `rem`; `rem` values are resolved against a pixel base before
 * being emitted. The `px` unit maps to Android density-independent pixels,
 * which the DTCG specification names as its Android equivalent.
 */
export class AndroidDimensionValueConverter {
    readonly #remBase: number;

    constructor(remBase: number = DEFAULT_REM_BASE) {
        this.#remBase = remBase;
    }

    /**
     * Converts a dimension to an Android literal in the given unit.
     *
     * @param value - Dimension to convert.
     * @param unit - Target Android unit.
     * @returns Android dimension literal, e.g. `16dp`.
     */
    convert(value: DimensionValue, unit: AndroidDimensionUnit): string {
        return `${this.#format(this.toPixels(value))}${unit}`;
    }

    /**
     * Resolves a dimension to its pixel magnitude, expanding `rem` against the
     * configured base.
     */
    toPixels(value: DimensionValue): number {
        return value.unit === "rem" ? value.value * this.#remBase : value.value;
    }

    #format(value: number): string {
        if (Number.isInteger(value)) return String(value);
        return String(Number(value.toFixed(MAX_FRACTION_DIGITS)));
    }
}
