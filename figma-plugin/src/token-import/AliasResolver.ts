/**
 * Orders variables so that an alias target is always created before the
 * variable referencing it.
 *
 * Figma aliases point at an existing variable id, so creation order matters.
 * DTCG references are `{dotted.path}` strings, which form a dependency graph.
 */

/** Extracts the referenced token path from a DTCG alias value. */
export function toReferencePath(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const match = REFERENCE_PATTERN.exec(value.trim());
    return match === null ? undefined : match[1]!.trim();
}

const REFERENCE_PATTERN = /^\{([^}]+)\}$/;

export function isReference(value: unknown): boolean {
    return toReferencePath(value) !== undefined;
}

/**
 * Sorts entries topologically by their alias dependencies.
 *
 * Entries whose dependencies fall outside the given set keep their relative
 * order: an unresolvable reference is not an ordering problem and is reported
 * separately by the planner.
 */
export interface AliasOrder<T> {
    /** Entries in creation order: targets before the entries referencing them. */
    ordered: T[];
    /** Entries dropped because they take part in a reference cycle. */
    cycles: AliasCycle[];
}

export interface AliasCycle {
    /** Token paths that form a reference cycle, in dotted form. */
    paths: string[];
}

export function orderByDependency<T>(
    entries: T[],
    keyOf: (entry: T) => string,
    dependenciesOf: (entry: T) => string[],
): AliasOrder<T> {
    const byKey = new Map<string, T>();
    for (const entry of entries) {
        byKey.set(keyOf(entry), entry);
    }

    const pending = new Map<string, Set<string>>();
    const dependents = new Map<string, string[]>();

    for (const entry of entries) {
        const key = keyOf(entry);
        const dependencies = dependenciesOf(entry).filter((dependency) => byKey.has(dependency));
        pending.set(key, new Set(dependencies));

        for (const dependency of dependencies) {
            const list = dependents.get(dependency) ?? [];
            list.push(key);
            dependents.set(dependency, list);
        }
    }

    // Seed the queue in input order so independent entries keep a stable order.
    const ready: string[] = [];
    for (const entry of entries) {
        const key = keyOf(entry);
        if (pending.get(key)!.size === 0) {
            ready.push(key);
        }
    }

    const ordered: T[] = [];
    while (ready.length > 0) {
        const key = ready.shift()!;
        ordered.push(byKey.get(key)!);

        for (const dependent of dependents.get(key) ?? []) {
            const remaining = pending.get(dependent);
            if (remaining === undefined) {
                continue;
            }

            remaining.delete(key);
            if (remaining.size === 0) {
                ready.push(dependent);
            }
        }
    }

    const unresolved = entries
        .map(keyOf)
        .filter((key) => !ordered.some((entry) => keyOf(entry) === key));

    return {
        ordered,
        cycles: unresolved.length === 0 ? [] : [{ paths: unresolved }],
    };
}
