import { TokenReference } from "#/core/model/TokenReference";
import { ColorOrReference } from "#/core/model/values/ColorValue";
import { DimensionOrReference } from "#/core/model/values/DimensionValue";

/**
 * A single shadow layer.
 *
 * @see https://tr.designtokens.org/format/#shadow
 */
export class ShadowLayer {
    readonly color: ColorOrReference;
    readonly offsetX: DimensionOrReference;
    readonly offsetY: DimensionOrReference;
    readonly blur: DimensionOrReference;
    readonly spread: DimensionOrReference;
    /** When true, renders as an inner shadow. Defaults to false. */
    readonly inset: boolean;

    constructor(
        color: ColorOrReference,
        offsetX: DimensionOrReference,
        offsetY: DimensionOrReference,
        blur: DimensionOrReference,
        spread: DimensionOrReference,
        inset = false,
    ) {
        this.color = color;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.blur = blur;
        this.spread = spread;
        this.inset = inset;
    }
}

/** A shadow layer or a reference to another shadow token. */
export type ShadowLayerOrReference = ShadowLayer | TokenReference;

/**
 * A shadow value is either a single layer or a list of layers (and/or references).
 * Multiple layers are rendered in order, like CSS `box-shadow`.
 *
 * @see https://tr.designtokens.org/format/#shadow
 */
export type ShadowValue = ShadowLayer | ShadowLayerOrReference[];

/** A shadow value or a reference to another shadow token. */
export type ShadowOrReference = ShadowValue | TokenReference;
