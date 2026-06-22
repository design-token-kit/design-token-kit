/**
 * How deep the check pipeline runs, as a typesafe enum.
 *
 * Scopes are strictly nested by depth: {@link CheckScope.SCHEMA} runs the least,
 * {@link CheckScope.LINT} the most. A scope runs every stage that the scopes
 * below it run.
 *
 * - {@link CheckScope.SCHEMA}: load and schema-validate only.
 * - {@link CheckScope.VALIDATE}: schema plus model-correctness checks.
 * - {@link CheckScope.LINT}: schema, model-correctness, and architecture checks.
 */
export class CheckScope {
    static readonly SCHEMA = new CheckScope("schema", 0);
    static readonly VALIDATE = new CheckScope("validate", 1);
    static readonly LINT = new CheckScope("lint", 2);

    private static readonly VALUES = [CheckScope.SCHEMA, CheckScope.VALIDATE, CheckScope.LINT];

    private constructor(readonly name: string, readonly rank: number) {}

    /**
     * Returns the scope with the given name.
     *
     * @throws when no scope has that name.
     */
    static fromName(name: string): CheckScope {
        const found = CheckScope.VALUES.find((scope) => scope.name === name);
        if (found === undefined) {
            throw new Error(`unknown scope '${name}'; expected ${CheckScope.names().join(", ")}`);
        }
        return found;
    }

    /**
     * Returns all scope names, lowest depth first.
     */
    static names(): string[] {
        return CheckScope.VALUES.map((scope) => scope.name);
    }

    /**
     * Returns true when this scope runs everything the other scope runs.
     */
    includes(other: CheckScope): boolean {
        return this.rank >= other.rank;
    }
}
