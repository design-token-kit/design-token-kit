/**
 * Token formats.
 */
export enum Format {

    /**
     * DTCG (Design Tokens Community Group) JSON token format.
     *
     * @see https://tr.designtokens.org/format/
     */
    DTCG = "dtcg",

    /**
     * HRDT (Human-Readable Design Tokens) YAML token format.
     */
    HRDT = "hrdt",

    /**
     * DESIGN.md markdown token format.
     *
     * @see https://github.com/google-labs-code/design.md
     */
    DESIGN_MD = "design-md",

    /**
     * CSS custom properties.
     */
    CSS = "css",

    /**
     * SCSS variables.
     */
    SCSS = "scss",

    /**
     * Tailwind CSS v4 theme variables.
     */
    TAILWIND_V4 = "tailwind-v4",
}
