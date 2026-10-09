import { TokenFormat } from "#/core/formats/TokenFormat";
import type { FormatDescriptor, FormatOptions } from "#/core/formats/FormatDescriptor";
import { DtcgReader } from "#/core/formats/dtcg/DtcgReader";
import { DtcgWriter } from "#/core/formats/dtcg/DtcgWriter";

/**
 * DTCG JSON: the canonical design token format.
 *
 * Detection is structural: content opening with a brace is JSON, whether or
 * not it parses. Requiring a successful parse would send a malformed document
 * to the fallback format, which would then report a YAML error for a JSON
 * file.
 */
export const dtcgFormat: FormatDescriptor = {
    format: TokenFormat.DTCG,
    suffixes: [".dtcg.json", ".json"],
    detect: (content) => content.trimStart().startsWith("{"),
    createReader: (options?: FormatOptions) => DtcgReader.create(options?.schema),
    createWriter: () => new DtcgWriter(),
};
