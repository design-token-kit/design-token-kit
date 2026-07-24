import type { FigmaFileReader, FigmaDocumentDto } from "./FigmaFileReader";
import { normalizeFileResponse } from "./normalize";

/**
 * Reads a Figma file through the in-plugin export API
 * ({@code page.exportAsync({ format: "JSON_REST_V1" })}).
 *
 * Iterates over every page of the current document and merges their
 * component, component-set and style buckets into a single response.
 */
export class PluginFigmaFileReader implements FigmaFileReader {
    readonly source = "plugin";

    async read(): Promise<Record<string, unknown>> {
        await loadAllPagesForExport();

        const pageExports = await Promise.all(
            figma.root.children.map((page) => page.exportAsync({ format: "JSON_REST_V1" })),
        );

        const firstPageExport: object | undefined = pageExports[0];

        return {
            name: figma.root.name,
            lastModified: null,
            thumbnailUrl: null,
            version: null,
            role: null,
            editorType: readField<string | null>(firstPageExport ?? {}, "editorType", "figma"),
            linkAccess: null,
            document: {
                id: figma.root.id,
                name: figma.root.name,
                type: "DOCUMENT",
                children: pageExports.map((pageExport) =>
                    readField<Record<string, unknown>>(pageExport, "document"),
                ),
            },
            components: Object.assign({}, ...pageExports.map((pageExport) =>
                readField<Record<string, unknown>>(pageExport, "components", {}),
            )),
            componentSets: Object.assign({}, ...pageExports.map((pageExport) =>
                readField<Record<string, unknown>>(pageExport, "componentSets", {}),
            )),
            styles: Object.assign({}, ...pageExports.map((pageExport) =>
                readField<Record<string, unknown>>(pageExport, "styles", {}),
            )),
            schemaVersion: 0,
        };
    }

    normalize(raw: Record<string, unknown>): FigmaDocumentDto {
        return normalizeFileResponse(raw);
    }
}

/**
 * Reads a field from an object, throwing if the field is missing and no
 * fallback was given.
 */
function readField<TValue>(
    value: object,
    fieldName: string,
    fallback?: TValue,
): TValue {
    if (fieldName in value) {
        return (value as Record<string, TValue>)[fieldName]!;
    }

    if (fallback !== undefined) {
        return fallback;
    }

    throw new Error(`Plugin JSON export is missing required field "${fieldName}".`);
}

/**
 * Ensures every page in the document is loaded before export.
 *
 * Uses {@code figma.loadAllPagesAsync} when available (modern API),
 * otherwise falls back to loading pages one by one.
 */
async function loadAllPagesForExport(): Promise<void> {
    if (typeof figma.loadAllPagesAsync === "function") {
        await figma.loadAllPagesAsync();
        return;
    }

    await Promise.all(figma.root.children.map((page) => page.loadAsync()));
}
