import type { Check } from "#/core/check/Check";
import { ReferenceCheck } from "#/core/check/checks/ReferenceCheck";
import { TypeMismatchCheck } from "#/core/check/checks/TypeMismatchCheck";
import { GradientStopCheck } from "#/core/check/checks/GradientStopCheck";
import { LayerReferenceCheck } from "#/core/check/checks/LayerReferenceCheck";
import { RawValueUsageCheck } from "#/core/check/checks/RawValueUsageCheck";

/**
 * Returns the checks that validate token correctness:
 * references, type mismatches and gradient stops.
 *
 * The order matters: references are checked before type mismatches so an alias
 * token emits its reference diagnostics before any type-mismatch diagnostic.
 */
export function validationChecks(): Check[] {
    return [new ReferenceCheck(), new TypeMismatchCheck(), new GradientStopCheck()];
}

/**
 * Returns the checks that enforce architecture-layering constraints.
 */
export function lintingChecks(): Check[] {
    return [new LayerReferenceCheck(), new RawValueUsageCheck()];
}
