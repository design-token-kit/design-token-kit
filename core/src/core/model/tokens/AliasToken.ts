import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";

/**
 * A token that is purely an alias to another token with no explicit `$type`.
 *
 * The effective type is determined by the referenced token and is not known
 * until the alias is resolved.
 *
 * @see https://tr.designtokens.org/format/#aliases-references
 */
export class AliasToken extends TokenNode<never> {
    constructor(
        ref: TokenReference,
        description?: string,
        deprecated?: boolean | string,
        extensions?: Record<string, unknown>,
    ) {
        super(undefined, ref, description, deprecated, extensions);
    }
}
