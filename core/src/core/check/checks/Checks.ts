import type { Check } from "#/core/check/Check";
import type { IssueSeverity } from "#/core/check/CheckIssue";
import { CheckScope } from "#/core/check/CheckScope";
import { ReferenceCheck } from "#/core/check/checks/ReferenceCheck";
import { TypeMismatchCheck } from "#/core/check/checks/TypeMismatchCheck";
import { GradientStopCheck } from "#/core/check/checks/GradientStopCheck";
import { LayerReferenceCheck } from "#/core/check/checks/LayerReferenceCheck";
import { RawValueUsageCheck } from "#/core/check/checks/RawValueUsageCheck";

/**
 * Describes one selectable check for discovery and documentation purposes.
 */
export interface CheckInfo {
    /** Check identifier, usable in the {@code checks} allow-list. */
    readonly id: string;

    /** Scope at which the check runs. */
    readonly scope: CheckScope;

    /** Severity of the issues the check emits. */
    readonly severity: IssueSeverity;

    /** One-line, human-readable summary of what the check enforces. */
    readonly description: string;
}

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

/**
 * Returns metadata for every selectable check, in pipeline order.
 *
 * Derives the scope from the same groupings the pipeline runs, so the listing
 * stays consistent with which checks actually execute at each scope.
 */
export function listChecks(): CheckInfo[] {
    return [
        ...validationChecks().map((check) => toCheckInfo(check, CheckScope.VALIDATE)),
        ...lintingChecks().map((check) => toCheckInfo(check, CheckScope.LINT)),
    ];
}

function toCheckInfo(check: Check, scope: CheckScope): CheckInfo {
    return {
        id: check.id,
        scope,
        severity: check.defaultSeverity,
        description: check.description,
    };
}
