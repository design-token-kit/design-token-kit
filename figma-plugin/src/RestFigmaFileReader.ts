import type { FigmaFileReader, FigmaDocumentDto } from "./FigmaFileReader";
import { normalizeFileResponse } from "./normalize";

/**
 * Reads a Figma file through the official REST API
 * ({@code GET /v1/files/:key}).
 *
 * Requires a personal access token passed to the constructor.
 */
export class RestFigmaFileReader implements FigmaFileReader {
    readonly source = "rest";

    /**
     * @param accessToken - Figma personal access token ({@code figd_...}).
     * @param fileKey - The file key from the editor URL.
     */
    constructor(
        private readonly accessToken: string,
        private readonly fileKey: string,
    ) {}

    async read(): Promise<Record<string, unknown>> {
        if (this.accessToken.trim() === "") {
            throw new Error("Enter a Figma access token before exporting REST JSON.");
        }

        const response = await fetch(`https://api.figma.com/v1/files/${this.fileKey}`, {
            headers: {
                "X-Figma-Token": this.accessToken.trim(),
            },
        });

        if (!response.ok) {
            throw new Error(`REST export failed: HTTP ${response.status}.`);
        }

        return response.json() as Promise<Record<string, unknown>>;
    }

    normalize(raw: Record<string, unknown>): FigmaDocumentDto {
        return normalizeFileResponse(raw);
    }
}
