import { DtcgJsonReader } from "@design-token-kit/core/core/io/DtcgJsonReader";
import { DtcgList } from "@design-token-kit/core/core/model/DtcgList";
import { CssTokenConverter } from "@design-token-kit/core/core/platforms/css/CssTokenConverter";
import { ScssTokenConverter } from "@design-token-kit/core/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "@design-token-kit/core/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "@design-token-kit/core/core/platforms/tailwind/TailwindTokenConverter";
import type { Dtcg } from "@design-token-kit/core/core/model/Dtcg";
import type { ExportedTokenFile } from "./TokenExporter";

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

    convert(request: TokenConversionRequest): ConvertedTokenFile[] {
        if (request.format === "dtcg") {
            return toDtcgFiles(request.files);
        }

        return this.#convertPlatform(request.files, request.format);
    }

    #convertPlatform(files: ExportedTokenFile[], format: PlatformTokenOutputFormat): ConvertedTokenFile[] {
        const list = toDtcgList(files);
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

function toDtcgList(files: ExportedTokenFile[]): DtcgList | undefined {
    const downloadableFiles = files.filter((file) => file.downloadable);
    const baseFile = downloadableFiles.find((file) => file.fileName === "tokens.json") ?? downloadableFiles[0];
    if (baseFile === undefined) {
        return undefined;
    }

    const reader = new DtcgJsonReader();
    const base = reader.parse(baseFile.content, baseFile.fileName);
    const themes = new Map<string, Dtcg>();

    for (const file of downloadableFiles) {
        if (file === baseFile) {
            continue;
        }

        themes.set(toThemeName(file.fileName), reader.parse(file.content, file.fileName));
    }

    return new DtcgList(base, themes);
}

function toThemeName(fileName: string): string {
    const match = /^tokens\.([^.]+)\.json$/.exec(fileName);
    return match?.[1] ?? fileName.replace(/\.json$/i, "");
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

type PlatformTokenOutputFormat = "css" | "scss" | "tailwind-v4" | "swiftui";

export type TokenOutputFormat = PlatformTokenOutputFormat | "dtcg";
