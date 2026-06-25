import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";

/**
 * A token representing a unitless number (e.g. opacity, line-height multiplier).
 *
 * @see https://tr.designtokens.org/format/#number
 */
export class NumberToken extends TokenNode<number> {
    constructor(
        value: number | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("number", value, description, deprecated, extensions);
    }
}
