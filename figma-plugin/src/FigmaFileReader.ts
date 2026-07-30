/**
 * A single node in the Figma document tree.
 *
 * Recursively describes the page hierarchy: each node may contain
 * nested {@link FigmaNodeDto children}.
 */
export interface FigmaNodeDto {
    id: string;
    name: string;
    type: string;
    children: FigmaNodeDto[];
}

/**
 * Summarised view of a Figma file, extracted from either a REST API
 * or Plugin API response.
 *
 * Lists every page, component, component set and style by their IDs.
 */
export interface FigmaDocumentDto {
    name: string;
    pages: FigmaNodeDto[];
    componentIds: string[];
    componentSetIds: string[];
    styleIds: string[];
}

/**
 * Reads a Figma file and normalises its JSON into a {@link FigmaDocumentDto}.
 *
 * Two sources are available: the official REST API
 * ({@link RestFigmaFileReader}) and the in-plugin export API
 * ({@link PluginFigmaFileReader}). Both implementations produce the
 * same DTO shape.
 */
export interface FigmaFileReader {
    /** Human-readable identifier of the data source. */
    readonly source: "rest" | "plugin";

    /**
     * Fetches or assembles the raw Figma file JSON.
     *
     * @returns The full file response object as returned by the source.
     */
    read(): Promise<Record<string, unknown>>;

    /**
     * Converts raw Figma JSON into a normalised {@link FigmaDocumentDto}.
     *
     * @param raw - The file response object returned by {@link read}.
     */
    normalize(raw: Record<string, unknown>): FigmaDocumentDto;
}
