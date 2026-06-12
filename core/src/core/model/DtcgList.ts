import { Dtcg } from "#/core/model/Dtcg";
import type { ValidationIssue } from "#/core/validation/TokenValidator";

/**
 * An ordered collection of DTCG documents representing a base token set and its theme overrides.
 *
 * The base document defines all tokens. Each theme document overrides a subset of them.
 * When validating a theme, references are resolved against the theme first, then the base.
 *
 * @see https://tr.designtokens.org/format/#file-format
 */
export class DtcgList {
    readonly base: Dtcg;
    readonly themes: ReadonlyMap<string, Dtcg>;

    constructor(base: Dtcg, themes?: Map<string, Dtcg>) {
        this.base = base;
        this.themes = themes ?? new Map();
    }

    validate(): ValidationIssue[] {
        const issues: ValidationIssue[] = this.base.validate();
        for (const theme of this.themes.values()) {
            issues.push(...theme.validate(this.base));
        }
        return issues;
    }
}
