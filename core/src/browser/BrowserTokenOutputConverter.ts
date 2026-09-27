import { DesignMdWriter } from "#/core/io/DesignMdWriter";
import { DtcgJsonWriter } from "#/core/io/DtcgJsonWriter";
import { DtcgToDesignMdMapper } from "#/core/io/DtcgToDesignMdMapper";
import { Format } from "#/core/io/Format";
import { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";
import { AndroidTokenConverter } from "#/core/platforms/android/AndroidTokenConverter";
import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { FigmaScriptTokenConverter } from "#/core/platforms/figma-script/FigmaScriptTokenConverter";
import { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
import { SwiftUiTokenConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
import { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";
import { CssTokenParser } from "#/core/showcase/CssTokenParser";
import { TokenHtmlShowcaseRenderer } from "#/core/showcase/TokenHtmlShowcaseRenderer";
import type { BrowserOutputFormat, BrowserTokenOutput } from "#/browser/BrowserTokenTypes";
import { BrowserDocumentError } from "#/browser/BrowserTokenValidationError";

/**
 * Adapts platform conversion strategies to downloadable browser outputs.
 */
export class BrowserTokenOutputConverter {
    /**
     * Produces uniquely named files or reports an output-format failure.
     */
    convert(list: DtcgList, format: BrowserOutputFormat): BrowserTokenOutput[] {
        if (!Object.hasOwn(CONVERTERS, format)) {
            throw new BrowserDocumentError(
                list.base.source ?? "browser-input",
                `Unsupported browser output format "${format}".`,
                "output-format",
            );
        }
        const outputs: BrowserTokenOutput[] = CONVERTERS[format](list);
        assertUniqueFileNames(outputs, list);
        return outputs;
    }
}

type OutputStrategy = (list: DtcgList) => BrowserTokenOutput[];

const CONVERTERS: Readonly<Record<BrowserOutputFormat, OutputStrategy>> = {
    [Format.DTCG]: (list) => documentOutputs(list, "json", (document) => new DtcgJsonWriter().write(document)),
    [Format.HRDT]: (list) => documentOutputs(list, "yaml", (document) => new HrdtTokenWriter().write(document)),
    [Format.DESIGN_MD]: (list) => documentOutputs(
        new DtcgToDesignMdMapper().map(list), "md", (document) => new DesignMdWriter().write(document),
    ),
    [Format.CSS]: (list) => [{ fileName: "tokens.css", content: new CssTokenConverter().convertList(list) }],
    [Format.SCSS]: (list) => new ScssTokenConverter().convertThemeList(list).map((output) => ({
        fileName: `tokens.${output.themeName}.scss`,
        content: output.content,
        themeName: output.themeName,
    })),
    [Format.TAILWIND_V4]: (list) => [{
        fileName: "tokens.tailwind.css", content: new TailwindTokenConverter().convertList(list),
    }],
    [Format.SWIFT_UI]: (list) => [{
        fileName: "DesignTokens.swift", content: new SwiftUiTokenConverter().convertList(list),
    }],
    [Format.FIGMA_SCRIPT]: (list) => [{
        fileName: "tokens.figma.js", content: new FigmaScriptTokenConverter().convertList(list),
    }],
    [Format.ANDROID]: (list) => new AndroidTokenConverter().convertResourceList(list).map((output) => ({
        fileName: output.filePath,
        content: output.content,
        themeName: output.themeName,
    })),
    showcase: (list) => [{
        fileName: "showcase.html",
        content: new TokenHtmlShowcaseRenderer().renderPage(
            new CssTokenParser().parse(new CssTokenConverter().convertList(list)),
        ),
    }],
};

function documentOutputs(list: DtcgList, extension: string, write: (document: Dtcg) => string): BrowserTokenOutput[] {
    return [
        { fileName: `tokens.${extension}`, content: write(list.base) },
        ...[...list.themes].map(([name, document]) => ({
            fileName: `tokens.${name}.${extension}`, content: write(document), themeName: name,
        })),
    ];
}

function assertUniqueFileNames(outputs: readonly BrowserTokenOutput[], list: DtcgList): void {
    const fileNames = new Set<string>();
    for (const output of outputs) {
        if (fileNames.has(output.fileName)) {
            const source: string = list.themes.get(output.themeName ?? "")?.source
                ?? list.base.source ?? "browser-input";
            throw new BrowserDocumentError(
                source,
                `Multiple outputs use file name "${output.fileName}". Rename the conflicting theme.`,
                "output-name",
            );
        }
        fileNames.add(output.fileName);
    }
}
