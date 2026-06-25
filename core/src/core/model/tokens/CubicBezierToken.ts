import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";

/**
 * A token representing a cubic-bezier easing function.
 *
 * @see https://tr.designtokens.org/format/#cubic-bezier
 */
export class CubicBezierToken extends TokenNode<CubicBezierValue> {
    constructor(
        value: CubicBezierValue | TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super("cubicBezier", value, description, deprecated, extensions);
    }
}
