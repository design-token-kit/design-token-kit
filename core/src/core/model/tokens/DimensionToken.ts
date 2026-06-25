import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { DimensionValue } from "#/core/model/values/DimensionValue";

/**
 * A token representing a distance value (e.g. spacing, size, radius).
 *
 * @see https://tr.designtokens.org/format/#dimension
 */
export class DimensionToken extends TokenNode<DimensionValue> {
    constructor(
        value: DimensionValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("dimension", value, description, deprecated, extensions);
    }
}
