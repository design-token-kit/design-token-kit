/**
 * A format that holds design tokens.
 *
 * Every member has a reader; a source detected as one of these can be read
 * into the token model.
 *
 * The values are the names the CLI accepts, so they are part of the public
 * contract.
 */
export enum TokenFormat {

    /**
     * DTCG (Design Tokens Community Group) JSON token format.
     *
     * @see https://tr.designtokens.org/format/
     */
    DTCG = "dtcg",

    /**
     * HRDT (Human-Readable Design Tokens) YAML token format.
     *
     * Defined by this project rather than an external standard; its schema is
     * the normative description.
     *
     * @see {@link ./hrdt/schemas/hrdt-tokens.json}
     */
    HRDT = "hrdt",

    /**
     * DESIGN.md markdown token format.
     *
     * @see https://github.com/google-labs-code/design.md
     */
    DESIGN_MD = "design-md",
}
