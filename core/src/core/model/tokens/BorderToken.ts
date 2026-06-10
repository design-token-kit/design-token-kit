import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderValue } from "#/core/model/values/BorderValue";

/**
 * A token representing a border style (color, width, and stroke style).
 *
 * @see https://tr.designtokens.org/format/#border
 */
export class BorderToken extends TokenNode<BorderValue> {
    constructor(
        value: BorderValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("border", value, description, deprecated, extensions);
    }
}
