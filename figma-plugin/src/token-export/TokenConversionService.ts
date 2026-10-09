import { DtcgReader } from "@design-token-kit/core/core/formats/dtcg/DtcgReader";
import { DtcgList } from "@design-token-kit/core/core/model/DtcgList";
import { TokenFileName } from "@design-token-kit/core/core/formats/TokenFileName";
import { FormatRegistry } from "@design-token-kit/core/core/formats/FormatRegistry";
import { TokenFormat } from "@design-token-kit/core/core/formats/TokenFormat";
import { AndroidTokenConverter } from "@design-token-kit/core/core/platforms/android/AndroidTokenConverter";
import { CssTokenConverter } from "@design-token-kit/core/core/platforms/css/CssTokenConverter";
import { ScssTokenConverter } from "@design-token-kit/core/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "@design-token-kit/core/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "@design-token-kit/core/core/platforms/tailwind/TailwindTokenConverter";
import type { Dtcg } from "@design-token-kit/core/core/model/Dtcg";
import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";

export interface ConvertedTokenFile {
    fileName: string;
    content: string;
    downloadable: boolean;
    tokens?: unknown;
}

export interface TokenConversionRequest {
    files: ExportedTokenFile[];
    format: TokenOutputFormat;
}

export class TokenConversionService {

    async convert(request: TokenConversionRequest): Promise<ConvertedTokenFile[]> {
        if (request.format === "dtcg") {
            return toDtcgFiles(request.files);
        }

        return this.#convertPlatform(request.files, request.format);
    }

    async #convertPlatform(files: ExportedTokenFile[], format: PlatformTokenOutputFormat): Promise<ConvertedTokenFile[]> {
        const list = await toDtcgList(files);
        if (list === undefined) {
            return [];
        }

        if (format === "css") {
            return [toFile("tokens.css", new CssTokenConverter().convertList(list))];
        }

        if (format === "scss") {
            return toScssFiles(list);
        }

        if (format === "tailwind-v4") {
            return [toFile("tokens.tailwind.css", new TailwindTokenConverter().convertList(list))];
        }

        if (format === "android") {
            return new AndroidTokenConverter().convertResourceList(list)
                .map((output) => toFile(output.filePath, output.content));
        }

        return [toFile("DesignTokens.swift", new SwiftUiTokenConverter().convertList(list))];
    }

}

function toDtcgFiles(files: ExportedTokenFile[]): ConvertedTokenFile[] {
    return files.map((file) => ({
        fileName: file.fileName,
        content: file.content,
        tokens: file.tokens,
        downloadable: file.downloadable,
    }));
}

async function toDtcgList(files: ExportedTokenFile[]): Promise<DtcgList | undefined> {
    const downloadableFiles = files.filter((file) => file.downloadable);
    const baseFile = downloadableFiles.find((file) => file.fileName === "tokens.json") ?? downloadableFiles[0];
    if (baseFile === undefined) {
        return undefined;
    }

    // No file system here, so no schema: the plugin reads back only the DTCG
    // it generated itself, and the reader's own checks cover it.
    const reader = DtcgReader.noSchema();
    const base = await readDocument(reader, baseFile);
    const themes = new Map<string, Dtcg>();

    for (const file of downloadableFiles) {
        if (file === baseFile) {
            continue;
        }

        themes.set(toThemeName(file.fileName), await readDocument(reader, file));
    }

    return new DtcgList(base, themes);
}

/**
 * Reads one exported file, turning a failed read into an exception.
 *
 * The plugin reports an export failure through a single catch, so a file the
 * reader rejected has to arrive there rather than as a value.
 */
async function readDocument(reader: DtcgReader, file: ExportedTokenFile): Promise<Dtcg> {
    const result = await reader.read(file.content, file.fileName);
    if (!result.ok) {
        throw new Error(
            `Unable to read ${file.fileName}:\n${result.issues.map((issue) => issue.message).join("\n")}`,
        );
    }
    return result.documents[0];
}

/**
 * The only format the plugin exports, so file names are read against it alone.
 *
 * Declared here rather than taken from the core descriptor: reading a name
 * needs the suffixes and nothing else, while the descriptor also knows how to
 * load a JSON Schema. The plugin bundles to a single IIFE, which inlines the
 * dynamic import that keeps AJV out of other bundles, so importing the
 * descriptor would put the schema library in a plugin that never validates.
 * The full registry would likewise pull in the DESIGN.md markdown parser.
 */
const DTCG_ONLY = new FormatRegistry([{
    format: TokenFormat.DTCG,
    suffixes: [".dtcg.json", ".json"],
    detect: (content: string) => content.trimStart().startsWith("{"),
    createReader: () => { throw new Error("The Figma plugin reads DTCG directly."); },
    createWriter: () => { throw new Error("The Figma plugin writes DTCG directly."); },
}]);

/**
 * Names the theme a file overrides, read as `<role>[.theme].<format>`; a file
 * carrying no theme is named by its role.
 */
function toThemeName(fileName: string): string {
    const name = TokenFileName.parse(fileName, DTCG_ONLY);
    return name.theme ?? name.role;
}

function toScssFiles(list: DtcgList): ConvertedTokenFile[] {
    const converter = new ScssTokenConverter();
    if (list.themes.size === 0) {
        return [toFile("tokens.scss", converter.convertList(list))];
    }

    return converter.convertThemeList(list).map((output) => {
        const fileName = output.isBase
            ? "tokens.scss"
            : `tokens.${output.themeName}.scss`;
        return toFile(fileName, output.content);
    });
}

function toFile(fileName: string, content: string): ConvertedTokenFile {
    return {
        fileName,
        content,
        downloadable: content.trim() !== "",
    };
}

type PlatformTokenOutputFormat = "css" | "scss" | "tailwind-v4" | "android" | "swiftui";

export type TokenOutputFormat = PlatformTokenOutputFormat | "dtcg";
