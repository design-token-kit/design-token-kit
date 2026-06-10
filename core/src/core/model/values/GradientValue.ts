import { TokenReference } from "#/core/model/TokenReference";
import { ColorOrReference } from "#/core/model/values/ColorValue";

/**
 * A single stop on a gradient.
 * Position is a number in [0, 1] where 0 is the start and 1 is the end.
 *
 * @see https://tr.designtokens.org/format/#gradient
 */
export class GradientStop {
    readonly color: ColorOrReference;
    /** Position along the gradient axis, in range [0, 1]. */
    readonly position: number | TokenReference;

    constructor(color: ColorOrReference, position: number | TokenReference) {
        this.color = color;
        this.position = position;
    }
}

/** A gradient stop or a reference to another gradient token. */
export type GradientStopOrReference = GradientStop | TokenReference;

/**
 * A gradient is an ordered list of stops (and/or references).
 *
 * @see https://tr.designtokens.org/format/#gradient
 */
export type GradientValue = GradientStopOrReference[];

/** A gradient value or a reference to another gradient token. */
export type GradientOrReference = GradientValue | TokenReference;
