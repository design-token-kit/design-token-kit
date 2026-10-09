import { DTCG_FORMAT_SCHEMA_ID } from "#/core/formats/dtcg/DtcgReader";
import type { SchemaValidator } from "#/core/formats/support/SchemaValidator";

/**
 * Builds DTCG readers that validate against the format's own JSON Schema.
 *
 * Kept apart from {@link DtcgReader} because reading a schema reaches the file
 * system. A browser bundle and the Figma plugin import the reader to parse
 * content they already hold, and importing this module instead of that one is
 * what keeps the Node.js modules and the JSON Schema library out of them.
 */

/**
 * Schemas this format ships, as directories under {@code ./schemas}.
 *
 * {@code "2025.10"} is stock DTCG. {@code "2025.10-design.md"} is that schema
 * extended with the {@code "em"} dimension unit.
 */
const BUILT_IN_SCHEMAS = ["2025.10", "2025.10-design.md"];

const DEFAULT_SCHEMA = "2025.10";


/**
 * Loads a DTCG JSON Schema from disk.
 *
 * @param schema - A built-in schema name, or a path to one of the user's own.
 */
export async function dtcgSchemaValidator(schema: string = DEFAULT_SCHEMA): Promise<SchemaValidator> {
    // A built-in name is a directory this format ships. Anything else is a
    // path to a schema of the user's own, which is how `--schema ./my` works.
    //
    // The name is appended to a plain `new URL(...)` rather than interpolated
    // into its literal, which Vite would treat as a glob and answer by
    // embedding every schema in the browser bundle.
    const location = BUILT_IN_SCHEMAS.includes(schema)
        ? new URL(schema + "/", new URL("./schemas/", import.meta.url))
        : schema;
    // Imported on call, not at module load: it reaches the file system, and
    // the browser entry keeps AJV in a chunk it loads only when validating.
    const { FormatSchema } = await import("#/core/formats/support/FormatSchema");
    return new FormatSchema(location, DTCG_FORMAT_SCHEMA_ID).validator();
}
