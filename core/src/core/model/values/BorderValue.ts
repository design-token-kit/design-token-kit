import { TokenReference } from "#/core/model/TokenReference";
import { ColorOrReference } from "#/core/model/values/ColorValue";
import { DimensionOrReference } from "#/core/model/values/DimensionValue";
import { StrokeStyleOrReference } from "#/core/model/values/StrokeStyleValue";

/**
 * Represents a border style combining color, width, and stroke style.
 *
 * @see https://tr.designtokens.org/format/#border
 */
export class BorderValue {
    readonly color: ColorOrReference;
    readonly width: DimensionOrReference;
    readonly style: StrokeStyleOrReference;

    constructor(
        color: ColorOrReference,
        width: DimensionOrReference,
        style: StrokeStyleOrReference,
    ) {
        this.color = color;
        this.width = width;
        this.style = style;
    }
}

/** A border value or a reference to another border token. */
export type BorderOrReference = BorderValue | TokenReference;
