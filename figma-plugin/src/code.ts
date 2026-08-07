import type { FigmaFileReader } from "#/figma-plugin/FigmaFileReader";
import { PluginFigmaFileReader, RestFigmaFileReader } from "#/figma-plugin/index";
import { TokenConversionService, type TokenOutputFormat } from "#/figma-plugin/token-export/TokenConversionService";
import { TokenExporter } from "#/figma-plugin/token-export/TokenExporter";
import { TokenImporter, type TokenImportRequest } from "#/figma-plugin/token-import/TokenImporter";

const MISSING_FILE_KEY_MESSAGE = "REST export requires figma.fileKey. "
    + "Reload the plugin after manifest update or run it as a private/local plugin.";

figma.showUI(__html__, {
    width: 680,
    height: 720,
});

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === "EXPORT_PLUGIN_JSON") {
        await exportWithReader(new PluginFigmaFileReader());
        return;
    }

    if (msg.type === "ANALYZE_TOKENS") {
        await analyzeTokens();
        return;
    }

    if (msg.type === "IMPORT_TOKENS") {
        await importTokens(msg);
        return;
    }

    const tokenOutputFormat = toTokenOutputFormat(msg.type);
    if (tokenOutputFormat !== undefined) {
        await exportTokens(tokenOutputFormat);
        return;
    }

    if (msg.type === "EXPORT_REST_JSON") {
        const fileKey = figma.fileKey;
        if (fileKey === undefined) {
            figma.notify(MISSING_FILE_KEY_MESSAGE, { error: true });
            return;
        }

        await exportWithReader(new RestFigmaFileReader(msg.accessToken, fileKey));
    }
};

async function importTokens(request: TokenImportRequest): Promise<void> {
    try {
        const result = await new TokenImporter().import(request);

        figma.ui.postMessage({
            type: "TOKENS_IMPORTED",
            payload: {
                summary: result.summary,
                skipped: result.skipped,
                warnings: result.warnings,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "IMPORT_FAILED",
            payload: {
                source: "import",
                message,
            },
        });
    }
}

async function analyzeTokens(): Promise<void> {
    try {
        const result = await new TokenExporter().export();

        figma.ui.postMessage({
            type: "TOKENS_ANALYZED",
            payload: {
                summary: result.summary,
                warnings: result.warnings,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "tokens",
                message,
            },
        });
    }
}

async function exportTokens(format: TokenOutputFormat): Promise<void> {
    try {
        const result = await new TokenExporter().export();
        const files = new TokenConversionService().convert({
            files: result.files,
            format,
        });

        figma.ui.postMessage({
            type: "TOKENS_EXPORTED",
            payload: {
                files,
                summary: result.summary,
                warnings: result.warnings,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "tokens",
                message,
            },
        });
    }
}

async function exportWithReader(reader: FigmaFileReader): Promise<void> {
    try {
        const raw = await reader.read();
        const dto = reader.normalize(raw);

        figma.ui.postMessage({
            type: "FILE_EXPORTED",
            payload: {
                source: reader.source,
                fileName: `${slugifyFileName(figma.root.name)}.${reader.source}.json`,
                content: JSON.stringify(raw, null, 2),
                dto,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "plugin",
                message,
            },
        });
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim() !== "") {
        return error.message;
    }

    if (typeof error === "string" && error.trim() !== "") {
        return error;
    }

    return "An unknown export error occurred.";
}

function slugifyFileName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "figma";
}

function toTokenOutputFormat(type: PluginMessage["type"]): TokenOutputFormat | undefined {
    switch (type) {
        case "EXPORT_TOKENS_JSON":
        case "EXPORT_TOKENS_DTCG":
            return "dtcg";
        case "EXPORT_TOKENS_CSS":
            return "css";
        case "EXPORT_TOKENS_SCSS":
            return "scss";
        case "EXPORT_TOKENS_TAILWIND":
            return "tailwind-v4";
        case "EXPORT_TOKENS_SWIFTUI":
            return "swiftui";
        default:
            return undefined;
    }
}

type PluginMessage =
    | { type: "EXPORT_PLUGIN_JSON" }
    | { type: "ANALYZE_TOKENS" }
    | { type: "EXPORT_TOKENS_JSON" }
    | { type: "EXPORT_TOKENS_DTCG" }
    | { type: "EXPORT_TOKENS_CSS" }
    | { type: "EXPORT_TOKENS_SCSS" }
    | { type: "EXPORT_TOKENS_TAILWIND" }
    | { type: "EXPORT_TOKENS_SWIFTUI" }
    | { type: "EXPORT_REST_JSON"; accessToken: string }
    | ({ type: "IMPORT_TOKENS" } & TokenImportRequest);
