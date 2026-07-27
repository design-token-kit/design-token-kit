import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";

/**
 * Converter for design tokens to a SwiftUI namespaced-enum API.
 */
export interface TokenSwiftUiConverter {
    /**
     * Converts a single token document to a Swift source string.
     *
     * @param doc - Parsed DTCG document
     * @returns Generated Swift source
     */
    convertDocument(doc: Dtcg): string;

    /**
     * Converts a base document and its theme overrides to a Swift source string.
     *
     * @param list - Base document plus named theme overrides
     * @returns Generated Swift source
     */
    convertList(list: DtcgList): string;
}
