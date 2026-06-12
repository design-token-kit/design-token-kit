export type {
    IssueSeverity,
    ValidationIssue,
    TokenValidator,
} from "#/core/validation/TokenValidator";
export type { TokenCssConverter } from "#/core/css/TokenCssConverter";
export type { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";

export { DtcgTokenCssConverter } from "#/core/css/DtcgTokenCssConverter";
export { TokenHtmlShowcaseBuilder } from "#/core/showcase/TokenHtmlShowcaseBuilder";
export { DtcgSchemaValidator } from "#/core/validation/dtcg/DtcgSchemaValidator";
export { HrdtTokenValidator } from "#/core/validation/hrdt/HrdtTokenValidator";
export { DtcgTokenValidator } from "#/core/validation/DtcgTokenValidator";

import { DtcgTokenCssConverter } from "#/core/css/DtcgTokenCssConverter";
import type { TokenCssConverter } from "#/core/css/TokenCssConverter";
import { DtcgTokenValidator } from "#/core/validation/DtcgTokenValidator";
import { TokenHtmlShowcaseBuilder } from "#/core/showcase/TokenHtmlShowcaseBuilder";
import type { TokenHtmlShowcase } from "#/core/showcase/TokenHtmlShowcase";

export function createTokenCssConverter(): TokenCssConverter {
    return new DtcgTokenCssConverter();
}

export function createTokenHtmlShowcase(): TokenHtmlShowcase {
    return new TokenHtmlShowcaseBuilder(
        new DtcgTokenValidator(),
        new DtcgTokenCssConverter(),
    );
}
export { DesignToken, DesignTokens } from "#/core/DesignToken";

export { Source } from "#/core/Source";

export type { TokenType } from "#/core/model/TokenType";
export { TokenReference } from "#/core/model/TokenReference";
export { TokenNode } from "#/core/model/TokenNode";
export { TokenGroup } from "#/core/model/TokenGroup";
export { Dtcg } from "#/core/model/Dtcg";
export { DtcgList } from "#/core/model/DtcgList";
export { DtcgListLoader, TokenSyntaxError } from "#/core/io/DtcgListLoader";
export { DtcgJsonReader, DtcgJsonReaderError } from "#/core/io/DtcgJsonReader";
export { DtcgJsonWriter } from "#/core/io/DtcgJsonWriter";
export { HrdtTokenReader, HrdtTokenReaderError } from "#/core/io/HrdtTokenReader";
export { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
export { FormatDetector } from "#/core/io/FormatDetector";
export { Format } from "#/core/io/Format";
