import { TokenReference } from "#/core/model/TokenReference";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DurationOrReference } from "#/core/model/values/DurationValue";

/**
 * A timing function is either a cubic-bezier or a reference to a cubicBezier token.
 *
 * @see https://tr.designtokens.org/format/#transition
 */
export type TimingFunctionOrReference = CubicBezierValue | TokenReference;

/**
 * Represents an animated transition between two states.
 *
 * @see https://tr.designtokens.org/format/#transition
 */
export class TransitionValue {
    readonly duration: DurationOrReference;
    readonly delay: DurationOrReference;
    readonly timingFunction: TimingFunctionOrReference;

    constructor(
        duration: DurationOrReference,
        delay: DurationOrReference,
        timingFunction: TimingFunctionOrReference,
    ) {
        this.duration = duration;
        this.delay = delay;
        this.timingFunction = timingFunction;
    }
}

/** A transition value or a reference to another transition token. */
export type TransitionOrReference = TransitionValue | TokenReference;
