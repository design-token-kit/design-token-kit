import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { TransitionValue } from "#/core/model/values/TransitionValue";

/**
 * A token representing an animated transition (duration, delay, timing function).
 *
 * @see https://tr.designtokens.org/format/#transition
 */
export class TransitionToken extends TokenNode<TransitionValue> {
    constructor(
        value: TransitionValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("transition", value, description, deprecated, extensions);
    }
}
