export type { IssueSeverity, CheckIssue } from "#/core/check/CheckIssue";
export type { TokenValidator } from "#/core/validation/TokenValidator";
export type { CssColorValueConverterOptions } from "#/core/platforms/css/CssColorValueConverter";
/**
 * @deprecated Use {@link CssColorValueConverterOptions}.
 */
export type { CssColorValueConverterOptions as ColorCssSerializerOptions } from "#/core/platforms/css/CssColorValueConverter";
export type { TokenConverter } from "#/core/platforms/TokenConverter";
export type { ScssTokenConverterOptions } from "#/core/platforms/scss/ScssTokenConverter";
/**
 * @deprecated Use {@link ScssTokenConverterOptions}.
 */
export type { ScssTokenConverterOptions as DtcgTokenScssConverterOptions } from "#/core/platforms/scss/ScssTokenConverter";
export type { ScssTokenOutput } from "#/core/platforms/scss/ScssTokenOutput";
/**
 * @deprecated Use {@link ScssTokenOutput}.
 */
export type { ScssTokenOutput as TokenScssOutput } from "#/core/platforms/scss/ScssTokenOutput";
export type { SwiftUiTokenConverterOptions } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
export type { SwiftUiTokenConverterOptions as DtcgTokenSwiftUiConverterOptions } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
export type { TailwindTokenConverterOptions } from "#/core/platforms/tailwind/TailwindTokenConverter";
/**
 * @deprecated Use {@link TailwindTokenConverterOptions}.
 */
export type { TailwindTokenConverterOptions as DtcgTailwindCssConverterOptions } from "#/core/platforms/tailwind/TailwindTokenConverter";
export type { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";
export type { TokenStats } from "#/core/stats/TokenStats";

export { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
export { CssColorValueConverter } from "#/core/platforms/css/CssColorValueConverter";
/**
 * @deprecated Use {@link CssColorValueConverter}.
 */
export { CssColorValueConverter as ColorCssSerializer } from "#/core/platforms/css/CssColorValueConverter";
/**
 * @deprecated Use {@link CssTokenConverter}.
 */
export { CssTokenConverter as DtcgTokenCssConverter } from "#/core/platforms/css/CssTokenConverter";
export { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
/**
 * @deprecated Use {@link ScssTokenConverter}.
 */
export { ScssTokenConverter as DtcgTokenScssConverter } from "#/core/platforms/scss/ScssTokenConverter";
export { SwiftUiTokenConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
export { SwiftUiColorValueConverter } from "#/core/platforms/swiftui/SwiftUiColorValueConverter";
export { SwiftUiColorValueConverter as ColorSwiftUiSerializer } from "#/core/platforms/swiftui/SwiftUiColorValueConverter";
export { SwiftUiTokenConverter as DtcgTokenSwiftUiConverter } from "#/core/platforms/swiftui/SwiftUiTokenConverter";
export { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";
/**
 * @deprecated Use {@link TailwindTokenConverter}.
 */
export { TailwindTokenConverter as DtcgTailwindCssConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";
export { TokenHtmlShowcaseBuilder } from "#/core/showcase/TokenHtmlShowcaseBuilder";
export { TokenStatsBuilder } from "#/core/stats/TokenStatsBuilder";
export { TokenStatsCalculator } from "#/core/stats/TokenStatsCalculator";
export { TokenStatsHtmlRenderer } from "#/core/stats/TokenStatsHtmlRenderer";
export { DtcgSchemaValidator } from "#/core/validation/dtcg/DtcgSchemaValidator";
export { HrdtTokenValidator } from "#/core/validation/hrdt/HrdtTokenValidator";
export { DtcgChecker } from "#/core/validation/DtcgChecker";
export type { CheckerOptions, CheckSelectionWarning, CheckSelectionProblem } from "#/core/validation/DtcgChecker";
export { CheckScope } from "#/core/check/CheckScope";

export { CheckRunner } from "#/core/check/CheckRunner";
export type { Check } from "#/core/check/Check";
export { TokenCheck } from "#/core/check/TokenCheck";
export type { CheckContext, ResolvedRef } from "#/core/check/CheckContext";
export { ReferenceCheck } from "#/core/check/checks/ReferenceCheck";
export { TypeMismatchCheck } from "#/core/check/checks/TypeMismatchCheck";
export { GradientStopCheck } from "#/core/check/checks/GradientStopCheck";
export { validationChecks, lintingChecks, listChecks } from "#/core/check/checks/Checks";
export type { CheckInfo } from "#/core/check/checks/Checks";
export { TokenLayers } from "#/core/check/TokenLayers";
export { LayerReferenceCheck } from "#/core/check/checks/LayerReferenceCheck";
export { RootLayerCheck } from "#/core/check/checks/RootLayerCheck";
export { RawValueUsageCheck } from "#/core/check/checks/RawValueUsageCheck";
export { EmptyGroupCheck } from "#/core/check/checks/EmptyGroupCheck";
export { MissingDescriptionCheck } from "#/core/check/checks/MissingDescriptionCheck";
export { TailwindNamespaceCheck } from "#/core/check/checks/TailwindNamespaceCheck";

import { CssTokenConverter } from "#/core/platforms/css/CssTokenConverter";
import { ScssTokenConverter } from "#/core/platforms/scss/ScssTokenConverter";
import { TailwindTokenConverter } from "#/core/platforms/tailwind/TailwindTokenConverter";
import type { ScssTokenConverterOptions } from "#/core/platforms/scss/ScssTokenConverter";
import type { TailwindTokenConverterOptions } from "#/core/platforms/tailwind/TailwindTokenConverter";
import { DtcgChecker } from "#/core/validation/DtcgChecker";
import { TokenStatsBuilder } from "#/core/stats/TokenStatsBuilder";
import type { TokenStats } from "#/core/stats/TokenStats";
import { TokenHtmlShowcaseBuilder } from "#/core/showcase/TokenHtmlShowcaseBuilder";
import type { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";

export function createCssTokenConverter(): CssTokenConverter {
    return new CssTokenConverter();
}

/**
 * @deprecated Use {@link createCssTokenConverter}.
 */
export function createTokenCssConverter(): CssTokenConverter {
    return createCssTokenConverter();
}

export function createScssTokenConverter(options?: ScssTokenConverterOptions): ScssTokenConverter {
    return new ScssTokenConverter(options);
}

/**
 * @deprecated Use {@link createScssTokenConverter}.
 */
export function createTokenScssConverter(options?: ScssTokenConverterOptions): ScssTokenConverter {
    return createScssTokenConverter(options);
}

export function createTailwindTokenConverter(options?: TailwindTokenConverterOptions): TailwindTokenConverter {
    return new TailwindTokenConverter(options);
}

/**
 * @deprecated Use {@link createTailwindTokenConverter}.
 */
export function createTailwindCssConverter(options?: TailwindTokenConverterOptions): TailwindTokenConverter {
    return createTailwindTokenConverter(options);
}

export function createTokenHtmlShowcase(): TokenHtmlShowcase {
    return new TokenHtmlShowcaseBuilder(
        new DtcgChecker(),
        new CssTokenConverter(),
    );
}
export { TokenFile, TokenFiles } from "#/core/io/TokenFile";

export function createTokenStats(): TokenStats {
    return new TokenStatsBuilder();
}

export { Source } from "#/core/io/Source";

export type { TokenType } from "#/core/model/TokenType";
export { TokenPath } from "#/core/model/TokenPath";
export { TokenReference } from "#/core/model/TokenReference";
export { TokenNode } from "#/core/model/TokenNode";
export { TokenGroup } from "#/core/model/TokenGroup";
export { walkTokenValue, walkValue } from "#/core/model/TokenValueWalker";
export type { ValueLeaf, LeafVisitor } from "#/core/model/TokenValueWalker";
export { Dtcg } from "#/core/model/Dtcg";
export { DtcgList } from "#/core/model/DtcgList";
export { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
export { DtcgJsonReader, DtcgJsonReaderError } from "#/core/io/DtcgJsonReader";
export { DtcgJsonWriter } from "#/core/io/DtcgJsonWriter";
export { HrdtTokenReader, HrdtTokenReaderError } from "#/core/io/HrdtTokenReader";
export { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
export { DesignMdReader, DesignMdReaderError } from "#/core/io/DesignMdReader";
export { DesignMdWriter } from "#/core/io/DesignMdWriter";
export { DtcgToDesignMdMapper } from "#/core/io/DtcgToDesignMdMapper";
export { FormatDetector } from "#/core/io/FormatDetector";
export { Format } from "#/core/io/Format";
