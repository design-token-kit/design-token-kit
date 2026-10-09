import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { JsonSchema, SchemaValidator } from "#/core/formats/support/SchemaValidator";
import { AjvSchemaValidator } from "#/core/formats/support/AjvSchemaValidator";

/**
 * The JSON Schema one format validates against.
 *
 * A format declares where its schema is and which {@code $id} to validate
 * against, then asks for a validator when it builds a reader.
 */
export class FormatSchema {
    readonly #location: URL | string;
    readonly #schemaId: string;

    /**
     * @param location - Where the schema is: one file, or a directory holding
     *   the parts of a split schema. A format states its own as a {@code URL}
     *   against {@code import.meta.url} of the declaring module - the build
     *   keeps a format's schemas at the same place relative to it, so one URL
     *   serves both running from source and running from a build. A plain
     *   string is a path given by the user, as {@code --schema ./my-schema}
     *   does.
     * @param schemaId - {@code $id} of the schema to validate against.
     */
    constructor(location: URL | string, schemaId: string) {
        this.#location = location;
        this.#schemaId = schemaId;
    }

    /**
     * Reads the schema and compiles a validator for it.
     *
     * Called once per reader, which is what lets reading a document stay
     * synchronous afterwards.
     */
    async validator(): Promise<SchemaValidator> {
        return new AjvSchemaValidator(await this.#read(), this.#schemaId);
    }

    /**
     * Reads every file of the schema.
     *
     * A directory is read whole, recursively: the parts of a split schema have
     * to be registered together to resolve their references. Only that
     * directory is read - after a build every format's schemas sit side by
     * side, and a neighbour's files would collide on duplicate {@code $id}s.
     */
    async #read(): Promise<JsonSchema[]> {
        const schemaPath = typeof this.#location === "string"
            ? this.#location
            : fileURLToPath(this.#location);
        const stats = await stat(schemaPath);
        const files = stats.isDirectory() ? await listJsonFiles(schemaPath) : [schemaPath];
        return Promise.all(files.map(readSchema));
    }
}

async function readSchema(file: string): Promise<JsonSchema> {
    return JSON.parse(await readFile(file, "utf8")) as JsonSchema;
}

async function listJsonFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listJsonFiles(entryPath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
            files.push(entryPath);
        }
    }

    return files;
}
