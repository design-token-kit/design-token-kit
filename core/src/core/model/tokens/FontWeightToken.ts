import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { FontWeightValue } from "#/core/model/values/TypographyValue";

/**
 * A token representing a font weight as a number (1-1000) or a keyword.
 *
 * @see https://tr.designtokens.org/format/#font-weight
 */
export class FontWeightToken extends TokenNode<FontWeightValue> {
    constructor(
        value: FontWeightValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("fontWeight", value, description, deprecated, extensions);
    }
}
