import type { Dtcg } from "#/core/model/Dtcg";

/**
 * Writes the {@link Dtcg} model back to one token format.
 *
 * The counterpart of {@link TokenReader}: reading a written document must
 * yield an equivalent model.
 */
export interface TokenWriter {
    /**
     * Writes one document as source text.
     *
     * @param doc - Document to write.
     * @returns Generated source in this writer's format.
     */
    write(doc: Dtcg): string;
}
