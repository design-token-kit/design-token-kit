import { HRDT_SCHEMA_ID } from "#/core/formats/hrdt/HrdtReader";
import type { SchemaValidator } from "#/core/formats/support/SchemaValidator";

/**
 * Builds readers that validate against this format's own JSON Schema.
 *
 * Kept apart from {@link HrdtReader} because reading a schema reaches the file
 * system. A browser bundle and the Figma plugin import the reader to parse
 * content they already hold, and importing this module instead of that one is
 * what keeps the Node.js modules and the JSON Schema library out of them.
 */


/**
 * Loads this format's JSON Schema from disk.
 */
export async function hrdtSchemaValidator(): Promise<SchemaValidator> {
    const location = new URL("./schemas/hrdt-tokens.json", import.meta.url);
    // Imported on call, not at module load: it reaches the file system, and
    // the browser entry keeps AJV in a chunk it loads only when validating.
    const { FormatSchema } = await import("#/core/formats/support/FormatSchema");
    return new FormatSchema(location, HRDT_SCHEMA_ID).validator();
}
