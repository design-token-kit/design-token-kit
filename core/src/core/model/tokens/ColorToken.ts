import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue } from "#/core/model/values/ColorValue";

/**
 * A token representing a color value.
 *
 * @see https://tr.designtokens.org/format/#color
 */
export class ColorToken extends TokenNode<ColorValue> {
    constructor(
        value: ColorValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("color", value, description, deprecated, extensions);
    }
}
