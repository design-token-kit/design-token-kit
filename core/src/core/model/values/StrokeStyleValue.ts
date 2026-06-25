import { TokenReference } from "#/core/model/TokenReference";
import { DimensionOrReference } from "#/core/model/values/DimensionValue";

/**
 * Pre-defined stroke style keywords, matching CSS line style values.
 *
 * @see https://tr.designtokens.org/format/#stroke-style
 */
export type StrokeStyleKeyword =
    | "solid"
    | "dashed"
    | "dotted"
    | "double"
    | "groove"
    | "ridge"
    | "outset"
    | "inset";

/**
 * Line cap style, matching SVG `stroke-linecap` values.
 *
 * @see https://tr.designtokens.org/format/#stroke-style
 */
export type LineCap = "round" | "butt" | "square";

/**
 * A custom stroke style defined by a dash array and line cap.
 *
 * @see https://tr.designtokens.org/format/#stroke-style
 */
export class StrokeStyleObject {
    /** Alternating dash and gap lengths. */
    readonly dashArray: DimensionOrReference[];
    readonly lineCap: LineCap;

    constructor(dashArray: DimensionOrReference[], lineCap: LineCap) {
        this.dashArray = dashArray;
        this.lineCap = lineCap;
    }
}

/**
 * A stroke style is either a pre-defined keyword or a custom dash-array object.
 *
 * @see https://tr.designtokens.org/format/#stroke-style
 */
export type StrokeStyleValue = StrokeStyleKeyword | StrokeStyleObject;

/** A stroke style value or a reference to another strokeStyle token. */
export type StrokeStyleOrReference = StrokeStyleValue | TokenReference;
