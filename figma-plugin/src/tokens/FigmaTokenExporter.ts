import { mapFigmaColorTokenName } from "./FigmaTokenNameMapper";

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

export type DtcgTokenDocument = Record<string, unknown>;

export type ExportedTokenFile = {
    fileName: string;
    content: string;
    tokens: DtcgTokenDocument;
};

export type TokenExportSummary = {
    source: "variables" | "styles" | "empty";
    colorTokens: number;
    skipped: number;
};

export type TokenExportResult = {
    files: ExportedTokenFile[];
    summary: TokenExportSummary;
    warnings: string[];
};

type TokenEntry = {
    path: string[];
    token: DtcgColorToken;
};

type FigmaColor = RGB & Partial<Pick<RGBA, "a">>;

type VariablePathIndex = Map<string, string[]>;

type VariableTokenReadResult = {
    foundVariables: boolean;
    tokens: TokenEntry[];
};

export class FigmaTokenExporter {

    async export(): Promise<TokenExportResult> {
        const warnings: string[] = [];
        const variableResult = await readColorVariableTokens(warnings);
        const styleTokens = !variableResult.foundVariables
            ? await readColorStyleTokens(warnings)
            : [];
        const tokens = variableResult.foundVariables ? variableResult.tokens : styleTokens;
        const source = variableResult.foundVariables
            ? "variables"
            : styleTokens.length > 0 ? "styles" : "empty";
        const document = buildTokenDocument(tokens);

        return {
            files: [
                {
                    fileName: "tokens.json",
                    content: JSON.stringify(document, null, 2),
                    tokens: document,
                },
            ],
            summary: {
                source,
                colorTokens: tokens.length,
                skipped: warnings.filter((warning) => warning.startsWith("Skipped ")).length,
            },
            warnings,
        };
    }

}

async function readColorVariableTokens(warnings: string[]): Promise<VariableTokenReadResult> {
    if (figma.variables === undefined) {
        warnings.push("Figma Variables API is unavailable. Falling back to paint styles.");
        return { foundVariables: false, tokens: [] };
    }

    let variables: Variable[];
    try {
        variables = await figma.variables.getLocalVariablesAsync("COLOR");
    } catch (error: unknown) {
        warnings.push(`Could not read Figma color variables: ${getErrorMessage(error)}. Falling back to paint styles.`);
        return { foundVariables: false, tokens: [] };
    }

    const variablePathIndex = createVariablePathIndex(variables);
    const tokens = variables.flatMap((variable) => {
        const nameMapping = mapFigmaColorTokenName(variable.name);
        if (nameMapping === undefined) {
            warnings.push(`Skipped color variable "${variable.name}" because it does not contain a valid token path.`);
            return [];
        }

        const tokenValue = firstTokenValue(variable.valuesByMode, variablePathIndex);
        if (tokenValue === undefined) {
            warnings.push(`Skipped color variable "${variable.name}" because it has no raw color value or resolvable alias.`);
            return [];
        }

        return [{
            path: nameMapping.path,
            token: createColorToken(tokenValue, variable.description),
        }];
    });

    return { foundVariables: variables.length > 0, tokens };
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
            token: createColorToken({ ...paint.color, a: paint.opacity ?? 1 }, style.description),
        }];
    });
}

function buildTokenDocument(tokens: TokenEntry[]): DtcgTokenDocument {
    const document: DtcgTokenDocument = {};

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
        const nameMapping = mapFigmaColorTokenName(variable.name);
        if (nameMapping !== undefined) {
            index.set(variable.id, nameMapping.path);
        }
    }

    return index;
}

function firstTokenValue(valuesByMode: { [modeId: string]: VariableValue }, variablePathIndex: VariablePathIndex): FigmaColor | string | undefined {
    for (const value of Object.values(valuesByMode)) {
        if (isVariableAlias(value)) {
            const path = variablePathIndex.get(value.id);
            if (path !== undefined) {
                return toDtcgReference(path);
            }
        }

        if (isColorValue(value)) {
            return value;
        }
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

function createColorToken(value: FigmaColor | string, description: string): DtcgColorToken {
    const token: DtcgColorToken = {
        $type: "color",
        $value: typeof value === "string" ? value : toDtcgColorValue(value),
    };

    if (description.trim() !== "") {
        token.$description = description;
    }

    return token;
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
