import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";

/**
 * Converts parsed design tokens to a platform-specific source string.
 *
 * Implementations define the target platform and output syntax.
 */
export interface TokenConverter {
    /**
     * Converts one parsed DTCG document.
     *
     * @param doc - Parsed DTCG document.
     * @returns Generated platform source.
     */
    convertDocument(doc: Dtcg): string;

    /**
     * Converts a base document and its theme overrides.
     *
     * @param list - Base document and named theme overrides.
     * @returns Generated platform source.
     */
    convertList(list: DtcgList): string;
}
