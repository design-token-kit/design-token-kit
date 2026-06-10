import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { TypographyValue } from "#/core/model/values/TypographyValue";

/**
 * A token representing a complete typographic style.
 *
 * @see https://tr.designtokens.org/format/#typography
 */
export class TypographyToken extends TokenNode<TypographyValue> {
    constructor(
        value: TypographyValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("typography", value, description, deprecated, extensions);
    }
}
