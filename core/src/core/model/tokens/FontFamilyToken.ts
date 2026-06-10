import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { FontFamilyValue } from "#/core/model/values/TypographyValue";

/**
 * A token representing a font family or a list of font families.
 *
 * @see https://tr.designtokens.org/format/#font-family
 */
export class FontFamilyToken extends TokenNode<FontFamilyValue> {
    constructor(
        value: FontFamilyValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("fontFamily", value, description, deprecated, extensions);
    }
}
