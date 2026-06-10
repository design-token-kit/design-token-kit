import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { DurationValue } from "#/core/model/values/DurationValue";

/**
 * A token representing an animation or transition duration.
 *
 * @see https://tr.designtokens.org/format/#duration
 */
export class DurationToken extends TokenNode<DurationValue> {
    constructor(
        value: DurationValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("duration", value, description, deprecated, extensions);
    }
}
