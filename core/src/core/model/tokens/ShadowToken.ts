import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ShadowValue } from "#/core/model/values/ShadowValue";

/**
 * A token representing a shadow style - either a single layer or a list of layers.
 *
 * @see https://tr.designtokens.org/format/#shadow
 */
export class ShadowToken extends TokenNode<ShadowValue> {
    constructor(
        value: ShadowValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("shadow", value, description, deprecated, extensions);
    }
}
