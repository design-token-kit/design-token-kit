import { TokenFormat } from "#/core/formats/TokenFormat";
import type { FormatDescriptor } from "#/core/formats/FormatDescriptor";
import { HrdtReader } from "#/core/formats/hrdt/HrdtReader";
import { HrdtWriter } from "#/core/formats/hrdt/HrdtWriter";

/**
 * HRDT: a compact YAML notation for design tokens.
 *
 * The format has no distinctive marker of its own, so it claims any content
 * the other formats declined. It must therefore be registered last.
 */
export const hrdtFormat: FormatDescriptor = {
    format: TokenFormat.HRDT,
    suffixes: [".hrdt.yaml", ".hrdt.yml", ".yaml", ".yml"],
    detect: () => true,
    createReader: () => HrdtReader.create(),
    createWriter: () => new HrdtWriter(),
};
