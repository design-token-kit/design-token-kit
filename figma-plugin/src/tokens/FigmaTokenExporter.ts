import { mapFigmaColorTokenName, mapFigmaTokenName } from "./FigmaTokenNameMapper";

export type DtcgColorValue = {
    colorSpace: "srgb";
    components: [number, number, number];
    alpha: number;
};

export type DtcgColorToken = {
    $type: "color";
    $value: DtcgColorValue | string;
    $description?: string;
};

export type DtcgDimensionValue = {
    value: number;
    unit: "px";
};

export type DtcgDimensionToken = {
    $type: "dimension";
    $value: DtcgDimensionValue | string;
    $description?: string;
};

export type DtcgNumberToken = {
    $type: "number";
    $value: number | string;
    $description?: string;
};

export type DtcgTypographyValue = {
    fontFamily: string;
    fontSize: DtcgDimensionValue;
    fontWeight: number;
    letterSpacing: DtcgDimensionValue;
    lineHeight: number;
};

export type DtcgTypographyToken = {
    $type: "typography";
    $value: DtcgTypographyValue;
    $description?: string;
};

export type DtcgShadowLayer = {
    color: DtcgColorValue;
    offsetX: DtcgDimensionValue;
    offsetY: DtcgDimensionValue;
    blur: DtcgDimensionValue;
    spread: DtcgDimensionValue;
    inset?: boolean;
};

export type DtcgShadowToken = {
    $type: "shadow";
    $value: DtcgShadowLayer | DtcgShadowLayer[];
    $description?: string;
};

export type DtcgToken = DtcgColorToken | DtcgDimensionToken | DtcgNumberToken | DtcgTypographyToken | DtcgShadowToken;

export type DtcgTokenDocument = Record<string, unknown>;

export type ExportedTokenFile = {
    fileName: string;
    content: string;
    tokens: DtcgTokenDocument;
    downloadable: boolean;
};

export type TokenExportSummary = {
    source: "variables" | "styles" | "empty";
    colorTokens: number;
    dimensionTokens: number;
    numberTokens: number;
    typographyTokens: number;
    shadowTokens: number;
    skipped: number;
};

export type TokenExportResult = {
    files: ExportedTokenFile[];
    summary: TokenExportSummary;
    warnings: string[];
};

type TokenEntry = {
    path: string[];
    token: DtcgToken;
};

type FigmaColor = RGB & Partial<Pick<RGBA, "a">>;

type VariablePathIndex = Map<string, string[]>;

type VariableTokenTypeIndex = Map<string, DtcgToken["$type"]>;

type VariableTokenReadResult = {
    foundVariables: boolean;
    files: ExportedTokenFile[];
    counts: TokenCounts;
};

type TokenCounts = {
    colorTokens: number;
    dimensionTokens: number;
    numberTokens: number;
    typographyTokens: number;
    shadowTokens: number;
};

type ModeExport = {
    fileName: string;
    modeIdByCollectionId: Map<string, string>;
    base: boolean;
};

export class FigmaTokenExporter {

    async export(): Promise<TokenExportResult> {
        const warnings: string[] = [];
        const variableResult = await readColorVariableTokens(warnings);
        const textStyleTokens = await readTextStyleTokens(warnings);
        const effectStyleTokens = await readEffectStyleTokens(warnings);
        const styleTokens = !variableResult.foundVariables
            ? await readColorStyleTokens(warnings)
            : [];
        const source = variableResult.foundVariables
            ? "variables"
            : styleTokens.length > 0 || textStyleTokens.length > 0 || effectStyleTokens.length > 0 ? "styles" : "empty";
        const baseStyleTokens = [...styleTokens, ...textStyleTokens, ...effectStyleTokens];
        const styleDocument = buildTokenDocument(baseStyleTokens);
        const files = variableResult.foundVariables
            ? addTokensToBaseFile(variableResult.files, [...textStyleTokens, ...effectStyleTokens])
            : [{
                fileName: "tokens.json",
                content: JSON.stringify(styleDocument, null, 2),
                tokens: styleDocument,
                downloadable: baseStyleTokens.length > 0,
            }];
        const counts = files.reduce((value, file) => addTokenCounts(value, countTokens(file.tokens)), emptyTokenCounts());

        return {
            files,
            summary: {
                source,
                colorTokens: counts.colorTokens,
                dimensionTokens: counts.dimensionTokens,
                numberTokens: counts.numberTokens,
                typographyTokens: counts.typographyTokens,
                shadowTokens: counts.shadowTokens,
                skipped: warnings.filter((warning) => warning.startsWith("Skipped ")).length,
            },
            warnings,
        };
    }

}

async function readColorVariableTokens(warnings: string[]): Promise<VariableTokenReadResult> {
    if (figma.variables === undefined) {
        warnings.push("Figma Variables API is unavailable. Falling back to paint styles.");
        return { foundVariables: false, files: [], counts: emptyTokenCounts() };
    }

    let variables: Variable[];
    try {
        const [colorVariables, floatVariables] = await Promise.all([
            figma.variables.getLocalVariablesAsync("COLOR"),
            figma.variables.getLocalVariablesAsync("FLOAT"),
        ]);
        variables = uniqueVariables([
            ...colorVariables.filter((variable) => getVariableResolvedType(variable) === "COLOR"),
            ...floatVariables.filter((variable) => getVariableResolvedType(variable) === "FLOAT"),
        ]);
    } catch (error: unknown) {
        warnings.push(`Could not read Figma color or float variables: ${getErrorMessage(error)}. Falling back to paint styles.`);
        return { foundVariables: false, files: [], counts: emptyTokenCounts() };
    }

    if (variables.length === 0) {
        return { foundVariables: false, files: [], counts: emptyTokenCounts() };
    }

    const variablePathIndex = createVariablePathIndex(variables);
    const variableTokenTypeIndex = createVariableTokenTypeIndex(variables);
    const modeExports = await createModeExports(variables, warnings);
    const files = modeExports.map((modeExport) => {
        const tokens = readVariableTokensForMode(variables, variablePathIndex, variableTokenTypeIndex, modeExport, warnings);
        const document = buildTokenDocument(tokens);

        return {
            fileName: modeExport.fileName,
            content: JSON.stringify(document, null, 2),
            tokens: document,
            downloadable: tokens.length > 0,
        };
    });
    const downloadableFiles = files.filter((file) => file.downloadable);

    return {
        foundVariables: true,
        files: downloadableFiles.length > 0 ? downloadableFiles : files.slice(0, 1),
        counts: downloadableFiles.reduce((counts, file) => addTokenCounts(counts, countTokens(file.tokens)), emptyTokenCounts()),
    };
}

function readVariableTokensForMode(
    variables: Variable[],
    variablePathIndex: VariablePathIndex,
    variableTokenTypeIndex: VariableTokenTypeIndex,
    modeExport: ModeExport,
    warnings: string[],
): TokenEntry[] {
    return variables.flatMap((variable) => {
        const tokenType = toTokenType(variable);
        if (tokenType === undefined) {
            return [];
        }

        const nameMapping = mapVariableTokenName(variable, tokenType);
        if (nameMapping === undefined) {
            warnings.push(`Skipped ${getVariableResolvedType(variable).toLowerCase()} variable "${variable.name}" because it does not contain a valid token path.`);
            return [];
        }

        const modeId = getModeId(variable, modeExport);
        const tokenValue = modeId === undefined
            ? undefined
            : toTokenValue(variable.valuesByMode[modeId], variablePathIndex, variableTokenTypeIndex, tokenType);
        if (tokenValue === undefined) {
            if (modeExport.base) {
                warnings.push(`Skipped ${getVariableResolvedType(variable).toLowerCase()} variable "${variable.name}" in ${modeExport.fileName} because it has no raw value or resolvable alias.`);
            }
            return [];
        }

        return [{
            path: nameMapping.path,
            token: createToken(tokenType, tokenValue, variable.description),
        }];
    });
}

async function readColorStyleTokens(warnings: string[]): Promise<TokenEntry[]> {
    const styles = await figma.getLocalPaintStylesAsync();

    return styles.flatMap((style) => {
        const nameMapping = mapFigmaColorTokenName(style.name);
        if (nameMapping === undefined) {
            warnings.push(`Skipped paint style "${style.name}" because it does not contain a valid token path.`);
            return [];
        }

        const paint = style.paints.find(isVisibleSolidPaint);
        if (paint === undefined) {
            warnings.push(`Skipped paint style "${style.name}" because it has no visible solid paint.`);
            return [];
        }

        return [{
            path: nameMapping.path,
            token: createToken("color", { ...paint.color, a: paint.opacity ?? 1 }, style.description),
        }];
    });
}

async function readTextStyleTokens(warnings: string[]): Promise<TokenEntry[]> {
    if (typeof figma.getLocalTextStylesAsync !== "function") {
        return [];
    }

    const styles = await figma.getLocalTextStylesAsync();

    return styles.flatMap((style) => {
        const nameMapping = mapFigmaTokenName(style.name, ["component", "typography"]);
        if (nameMapping === undefined) {
            warnings.push(`Skipped text style "${style.name}" because it does not contain a valid token path.`);
            return [];
        }

        return [{
            path: nameMapping.path,
            token: createTypographyToken(style),
        }];
    });
}

async function readEffectStyleTokens(warnings: string[]): Promise<TokenEntry[]> {
    if (typeof figma.getLocalEffectStylesAsync !== "function") {
        return [];
    }

    const styles = await figma.getLocalEffectStylesAsync();

    return styles.flatMap((style) => {
        const nameMapping = mapFigmaTokenName(style.name, ["component", "shadow"]);
        if (nameMapping === undefined) {
            warnings.push(`Skipped effect style "${style.name}" because it does not contain a valid token path.`);
            return [];
        }

        const shadowLayers = style.effects
            .filter(isVisibleShadowEffect)
            .map(toShadowLayer);

        if (shadowLayers.length === 0) {
            warnings.push(`Skipped effect style "${style.name}" because it has no visible shadow effects.`);
            return [];
        }

        if (style.effects.some((effect) => effect.visible !== false && !isShadowEffect(effect))) {
            warnings.push(`Skipped unsupported non-shadow effects in effect style "${style.name}".`);
        }

        return [{
            path: nameMapping.path,
            token: createShadowToken(shadowLayers, style.description),
        }];
    });
}

function addTokensToBaseFile(files: ExportedTokenFile[], tokens: TokenEntry[]): ExportedTokenFile[] {
    if (tokens.length === 0) {
        return files;
    }

    const baseFileIndex = files.findIndex((file) => file.fileName === "tokens.json");
    const baseDocument = baseFileIndex === -1 ? {} : files[baseFileIndex]!.tokens;
    const document = buildTokenDocumentFrom(baseDocument, tokens);
    const baseFile = {
        fileName: "tokens.json",
        content: JSON.stringify(document, null, 2),
        tokens: document,
        downloadable: true,
    };

    if (baseFileIndex === -1) {
        return [baseFile, ...files];
    }

    return files.map((file, index) => index === baseFileIndex ? baseFile : file);
}

function buildTokenDocument(tokens: TokenEntry[]): DtcgTokenDocument {
    return buildTokenDocumentFrom({}, tokens);
}

function buildTokenDocumentFrom(baseDocument: DtcgTokenDocument, tokens: TokenEntry[]): DtcgTokenDocument {
    const document: DtcgTokenDocument = JSON.parse(JSON.stringify(baseDocument)) as DtcgTokenDocument;

    for (const entry of tokens) {
        let target = document;
        for (const segment of entry.path.slice(0, -1)) {
            if (!isRecord(target[segment])) {
                target[segment] = {};
            }
            target = target[segment] as DtcgTokenDocument;
        }
        target[entry.path[entry.path.length - 1]!] = entry.token;
    }

    return document;
}

function createVariablePathIndex(variables: Variable[]): VariablePathIndex {
    const index: VariablePathIndex = new Map();

    for (const variable of variables) {
        const tokenType = toTokenType(variable);
        const nameMapping = tokenType === undefined ? undefined : mapVariableTokenName(variable, tokenType);
        if (nameMapping !== undefined) {
            index.set(variable.id, nameMapping.path);
        }
    }

    return index;
}

function createVariableTokenTypeIndex(variables: Variable[]): VariableTokenTypeIndex {
    const index: VariableTokenTypeIndex = new Map();

    for (const variable of variables) {
        const tokenType = toTokenType(variable);
        if (tokenType !== undefined) {
            index.set(variable.id, tokenType);
        }
    }

    return index;
}

function toTokenType(variable: Variable): DtcgToken["$type"] | undefined {
    const resolvedType = getVariableResolvedType(variable);
    if (resolvedType === "COLOR") {
        return "color";
    }

    if (resolvedType === "FLOAT") {
        return isNumberVariable(variable) ? "number" : "dimension";
    }

    return undefined;
}

function isNumberVariable(variable: Variable): boolean {
    return getVariableScopes(variable).includes("OPACITY") || variable.name.toLowerCase().includes("opacity");
}

function mapVariableTokenName(variable: Variable, tokenType: DtcgToken["$type"]): ReturnType<typeof mapFigmaColorTokenName> {
    if (tokenType === "color") {
        return mapFigmaColorTokenName(variable.name);
    }

    return mapFigmaTokenName(variable.name, toFloatFallbackPrefix(variable, tokenType));
}

function toFloatFallbackPrefix(variable: Variable, tokenType: "dimension" | "number"): string[] {
    if (tokenType === "number") {
        return ["primitive", "opacity"];
    }

    const scope = getVariableScopes(variable).find((value) => value === "GAP" || value === "CORNER_RADIUS" || value === "WIDTH_HEIGHT" || value === "STROKE_FLOAT");
    if (scope === "GAP") {
        return ["primitive", "spacing"];
    }

    if (scope === "CORNER_RADIUS") {
        return ["primitive", "radius"];
    }

    if (scope === "WIDTH_HEIGHT") {
        return ["primitive", "size"];
    }

    if (scope === "STROKE_FLOAT") {
        return ["primitive", "border", "width"];
    }

    return ["primitive", inferDimensionGroup(variable.name)];
}

function getVariableResolvedType(variable: Variable): VariableResolvedDataType {
    if (variable.resolvedType !== undefined) {
        return variable.resolvedType;
    }

    const value = Object.values(variable.valuesByMode)[0];
    return typeof value === "number" ? "FLOAT" : "COLOR";
}

function getVariableScopes(variable: Variable): VariableScope[] {
    return variable.scopes ?? [];
}

function uniqueVariables(variables: Variable[]): Variable[] {
    return Array.from(new Map(variables.map((variable) => [variable.id, variable])).values());
}

function inferDimensionGroup(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes("radius")) {
        return "radius";
    }

    if (normalized.includes("size") || normalized.includes("width") || normalized.includes("height")) {
        return "size";
    }

    if (normalized.includes("border")) {
        return "border";
    }

    return "spacing";
}

async function createModeExports(variables: Variable[], warnings: string[]): Promise<ModeExport[]> {
    const collections = await readVariableCollections(warnings);
    const usedCollections = collections.filter((collection) => variables.some((variable) => variable.variableCollectionId === collection.id));

    if (usedCollections.length === 0) {
        return [{
            fileName: "tokens.json",
            modeIdByCollectionId: new Map(variables.map((variable) => [variable.variableCollectionId, Object.keys(variable.valuesByMode)[0] ?? ""])),
            base: true,
        }];
    }

    const baseModeIds = new Map(usedCollections.map((collection) => [collection.id, collection.defaultModeId]));
    const themeModeExports = usedCollections.flatMap((collection) => collection.modes
        .filter((mode) => mode.modeId !== collection.defaultModeId)
        .map((mode) => ({
            fileName: `tokens.${slugifyFileName(mode.name)}.json`,
            modeIdByCollectionId: new Map([[collection.id, mode.modeId]]),
            base: false,
        })));

    return [
        {
            fileName: "tokens.json",
            modeIdByCollectionId: baseModeIds,
            base: true,
        },
        ...themeModeExports,
    ];
}

async function readVariableCollections(warnings: string[]): Promise<VariableCollection[]> {
    if (typeof figma.variables.getLocalVariableCollectionsAsync !== "function") {
        return [];
    }

    try {
        return await figma.variables.getLocalVariableCollectionsAsync();
    } catch (error: unknown) {
        warnings.push(`Could not read Figma variable collections: ${getErrorMessage(error)}. Exporting a single tokens.json file.`);
        return [];
    }
}

function getModeId(variable: Variable, modeExport: ModeExport): string | undefined {
    const collectionModeId = modeExport.modeIdByCollectionId.get(variable.variableCollectionId);
    if (collectionModeId !== undefined && collectionModeId in variable.valuesByMode) {
        return collectionModeId;
    }

    if (modeExport.fileName === "tokens.json") {
        return Object.keys(variable.valuesByMode)[0];
    }

    return undefined;
}

function toTokenValue(
    value: VariableValue | undefined,
    variablePathIndex: VariablePathIndex,
    variableTokenTypeIndex: VariableTokenTypeIndex,
    tokenType: DtcgToken["$type"],
): FigmaColor | number | string | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (isVariableAlias(value)) {
        const path = variablePathIndex.get(value.id);
        const aliasTokenType = variableTokenTypeIndex.get(value.id);
        return path === undefined || aliasTokenType !== tokenType ? undefined : toDtcgReference(path);
    }

    if (tokenType === "color" && isColorValue(value)) {
        return value;
    }

    if ((tokenType === "dimension" || tokenType === "number") && typeof value === "number") {
        return value;
    }

    return undefined;
}

function isColorValue(value: VariableValue): value is FigmaColor {
    return typeof value === "object"
        && value !== null
        && "r" in value
        && "g" in value
        && "b" in value;
}

function isVariableAlias(value: VariableValue): value is VariableAlias {
    return typeof value === "object"
        && value !== null
        && "type" in value
        && value.type === "VARIABLE_ALIAS";
}

function isVisibleSolidPaint(paint: Paint): paint is SolidPaint {
    return paint.type === "SOLID" && paint.visible !== false;
}

function createToken(tokenType: DtcgToken["$type"], value: FigmaColor | number | string, description: string): DtcgToken {
    const token: DtcgToken = createTokenWithoutDescription(tokenType, value);

    if (description.trim() !== "") {
        token.$description = description;
    }

    return token;
}

function createTokenWithoutDescription(tokenType: DtcgToken["$type"], value: FigmaColor | number | string): DtcgToken {
    if (tokenType === "color") {
        return {
            $type: "color",
            $value: typeof value === "string" ? value : toDtcgColorValue(value as FigmaColor),
        };
    }

    if (tokenType === "dimension") {
        return {
            $type: "dimension",
            $value: typeof value === "string" ? value : { value: value as number, unit: "px" },
        };
    }

    return {
        $type: "number",
        $value: value as number | string,
    };
}

function createTypographyToken(style: TextStyle): DtcgTypographyToken {
    const token: DtcgTypographyToken = {
        $type: "typography",
        $value: {
            fontFamily: style.fontName.family,
            fontSize: toDimensionValue(style.fontSize),
            fontWeight: toFontWeight(style.fontName.style),
            letterSpacing: toLetterSpacingValue(style.letterSpacing, style.fontSize),
            lineHeight: toLineHeightValue(style.lineHeight, style.fontSize),
        },
    };

    if (style.description.trim() !== "") {
        token.$description = style.description;
    }

    return token;
}

function createShadowToken(layers: DtcgShadowLayer[], description: string): DtcgShadowToken {
    const token: DtcgShadowToken = {
        $type: "shadow",
        $value: layers.length === 1 ? layers[0]! : layers,
    };

    if (description.trim() !== "") {
        token.$description = description;
    }

    return token;
}

function isShadowEffect(effect: Effect): effect is DropShadowEffect | InnerShadowEffect {
    return effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";
}

function isVisibleShadowEffect(effect: Effect): effect is DropShadowEffect | InnerShadowEffect {
    return isShadowEffect(effect) && effect.visible !== false;
}

function toShadowLayer(effect: DropShadowEffect | InnerShadowEffect): DtcgShadowLayer {
    const layer: DtcgShadowLayer = {
        color: toDtcgColorValue(effect.color),
        offsetX: toDimensionValue(effect.offset.x),
        offsetY: toDimensionValue(effect.offset.y),
        blur: toDimensionValue(effect.radius),
        spread: toDimensionValue(effect.spread ?? 0),
    };

    if (effect.type === "INNER_SHADOW") {
        layer.inset = true;
    }

    return layer;
}

function toDimensionValue(value: number): DtcgDimensionValue {
    return { value, unit: "px" };
}

function toLetterSpacingValue(letterSpacing: LetterSpacing, fontSize: number): DtcgDimensionValue {
    if (letterSpacing.unit === "PERCENT") {
        return toDimensionValue((letterSpacing.value / 100) * fontSize);
    }

    return toDimensionValue(letterSpacing.value);
}

function toLineHeightValue(lineHeight: LineHeight, fontSize: number): number {
    if (lineHeight.unit === "AUTO") {
        return 1;
    }

    if (lineHeight.unit === "PERCENT") {
        return lineHeight.value / 100;
    }

    return lineHeight.value / fontSize;
}

function toFontWeight(fontStyle: string): number {
    const normalized = fontStyle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (normalized.includes("thin") || normalized.includes("hairline")) return 100;
    if (normalized.includes("extra-light") || normalized.includes("ultra-light")) return 200;
    if (normalized.includes("light")) return 300;
    if (normalized.includes("medium")) return 500;
    if (normalized.includes("semi-bold") || normalized.includes("demi-bold")) return 600;
    if (normalized.includes("extra-bold") || normalized.includes("ultra-bold")) return 800;
    if (normalized.includes("black") || normalized.includes("heavy")) return 900;
    if (normalized.includes("bold")) return 700;
    return 400;
}

function toDtcgColorValue(color: FigmaColor): DtcgColorValue {
    return {
        colorSpace: "srgb",
        components: [color.r, color.g, color.b],
        alpha: color.a ?? 1,
    };
}

function toDtcgReference(path: string[]): string {
    return `{${path.join(".")}}`;
}

function countTokens(value: unknown): TokenCounts {
    if (!isRecord(value)) {
        return emptyTokenCounts();
    }

    if ("$type" in value && "$value" in value) {
        return countSingleToken(value.$type);
    }

    return Object.values(value).reduce((counts, child) => addTokenCounts(counts, countTokens(child)), emptyTokenCounts());
}

function countSingleToken(tokenType: unknown): TokenCounts {
    return {
        colorTokens: tokenType === "color" ? 1 : 0,
        dimensionTokens: tokenType === "dimension" ? 1 : 0,
        numberTokens: tokenType === "number" ? 1 : 0,
        typographyTokens: tokenType === "typography" ? 1 : 0,
        shadowTokens: tokenType === "shadow" ? 1 : 0,
    };
}

function emptyTokenCounts(): TokenCounts {
    return {
        colorTokens: 0,
        dimensionTokens: 0,
        numberTokens: 0,
        typographyTokens: 0,
        shadowTokens: 0,
    };
}

function addTokenCounts(left: TokenCounts, right: TokenCounts): TokenCounts {
    return {
        colorTokens: left.colorTokens + right.colorTokens,
        dimensionTokens: left.dimensionTokens + right.dimensionTokens,
        numberTokens: left.numberTokens + right.numberTokens,
        typographyTokens: left.typographyTokens + right.typographyTokens,
        shadowTokens: left.shadowTokens + right.shadowTokens,
    };
}

function slugifyFileName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "theme";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim() !== "") {
        return error.message;
    }

    if (typeof error === "string" && error.trim() !== "") {
        return error;
    }

    return "unknown error";
}
