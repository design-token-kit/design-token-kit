import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { StrokeStyleValue } from "#/core/model/values/StrokeStyleValue";

/**
 * A token representing a stroke (line) style - either a keyword or a custom dash pattern.
 *
 * @see https://tr.designtokens.org/format/#stroke-style
 */
export class StrokeStyleToken extends TokenNode<StrokeStyleValue> {
    constructor(
        value: StrokeStyleValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("strokeStyle", value, description, deprecated, extensions);
    }
}
