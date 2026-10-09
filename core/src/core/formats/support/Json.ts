/**
 * JSON value shapes shared by the token readers.
 *
 * Readers accept content that has already been parsed from JSON or YAML into
 * plain JavaScript values, so they all describe their input with these types.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

/**
 * Returns true when the value is a plain JSON object, excluding arrays and
 * {@code null}.
 */
export function isJsonObject(value: unknown): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rounds a number to three decimal places.
 *
 * Token values come from human-authored sources, where trailing floating-point
 * noise is never meaningful.
 */
export function round(value: number): number {
    return Number(value.toFixed(3));
}
