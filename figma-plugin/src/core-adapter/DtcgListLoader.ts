import type { TokenFormat } from "@design-token-kit/core/core/formats/TokenFormat";

/**
 * Replaces the core file-source loader inside the Figma plugin bundle.
 *
 * Core platform converters keep a `DtcgListLoader` field for their
 * `convert(sources)` API.
 * That API reads files and depends on Node modules, so it cannot run in Figma.
 *
 * The plugin never calls `convert(sources)`.
 * It exports tokens from Figma, builds a `DtcgList` in memory, and calls
 * `convertList()` on the real core converters.
 *
 * Vite aliases only `#/core/io/DtcgListLoader` to this adapter.
 * All other `#/...` imports still resolve to `core/src/*`, matching the
 * package-import layout used by the rest of the workspace.
 */
const UNAVAILABLE = "File-source token loading is unavailable in the Figma plugin.";

export class DtcgListLoader {

    constructor(_schemaVersion?: string) {}

    async read(_sources: string[], _forcedFormat?: TokenFormat): Promise<never> {
        throw new Error(UNAVAILABLE);
    }

    async load(_sources: string[], _forcedFormat?: TokenFormat): Promise<never> {
        throw new Error(UNAVAILABLE);
    }

}
