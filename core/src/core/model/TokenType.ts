/**
 * All token types defined in the DTCG 2025.10 specification.
 *
 * @see https://tr.designtokens.org/format/#types
 */
export const TOKEN_TYPES = [
    "color",
    "dimension",
    "fontFamily",
    "fontWeight",
    "number",
    "duration",
    "cubicBezier",
    "strokeStyle",
    "border",
    "transition",
    "shadow",
    "gradient",
    "typography",
] as const;

/**
 * A token type defined in the DTCG 2025.10 specification.
 *
 * @see https://tr.designtokens.org/format/#types
 */
export type TokenType = (typeof TOKEN_TYPES)[number];

/**
 * Returns true when the value names a DTCG token type.
 *
 * @param value - Value read from untyped input such as parsed JSON.
 */
export function isTokenType(value: unknown): value is TokenType {
    return typeof value === "string" && (TOKEN_TYPES as readonly string[]).includes(value);
}
