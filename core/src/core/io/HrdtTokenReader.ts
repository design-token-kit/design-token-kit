import { readFile } from "node:fs/promises";
import { HrdtTokenParser } from "#/core/io/HrdtTokenParser";
import type { Dtcg } from "#/core/model/Dtcg";

export { HrdtTokenReaderError } from "#/core/io/HrdtTokenParser";

/**
 * Reads HRDT token content and local files in the Node.js runtime.
 *
 * Use {@link HrdtTokenParser} when the caller already owns the content,
 * including browser applications where the file system is unavailable.
 */
export class HrdtTokenReader extends HrdtTokenParser {

    async parseFile(filePath: string): Promise<Dtcg> {
        return this.parse(await readFile(filePath, "utf8"));
    }

}
