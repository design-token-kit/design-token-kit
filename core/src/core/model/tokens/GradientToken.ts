import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { GradientValue } from "#/core/model/values/GradientValue";

/**
 * A token representing a color gradient as an ordered list of stops.
 *
 * @see https://tr.designtokens.org/format/#gradient
 */
export class GradientToken extends TokenNode<GradientValue> {
    constructor(
        value: GradientValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("gradient", value, description, deprecated, extensions);
    }
}
