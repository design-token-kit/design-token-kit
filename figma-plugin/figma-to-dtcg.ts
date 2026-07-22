/**
 * Describes the subset of a Figma Variable required for color conversion.
 */
export type FigmaVariableInput = Pick<
    Variable,
    | "id"
    | "name"
    | "description"
    | "hiddenFromPublishing"
    | "remote"
    | "variableCollectionId"
    | "key"
    | "resolvedType"
    | "valuesByMode"
    | "scopes"
    | "codeSyntax"
>;

/**
 * Describes the explicitly selected mode for conversion.
 */
export type FigmaModeSelection = {
    modeId: string;
    label: string;
};

/**
 * Represents a DTCG color value in the sRGB color space.
 */
type DtcgColorValue = {
    colorSpace: "srgb";
    components: [number, number, number];
    alpha: number;
    hex?: string;
};

type DtcgColorReference = string;

/**
 * Represents a DTCG color token.
 */
type DtcgColorToken = {
    $type: "color";
    $value: DtcgColorValue | DtcgColorReference;
    $description?: string;
    $extensions?: {
        "com.figma": {
            hiddenFromPublishing: boolean;
            remote: boolean;
            variableId: string;
            variableCollectionId: string;
            key: string;
            scopes: VariableScope[];
            codeSyntax: Partial<Record<CodeSyntaxPlatform, string>>;
        };
    };
};

/**
 * Represents nested DTCG token groups keyed by Variable name segments.
 */
export type DtcgTokenTree = {
    [name: string]: DtcgColorToken | DtcgTokenTree;
};

/**
 * Describes a Variable that could not be added to the DTCG tree.
 */
export type ConversionIssue = {
    path: string;
    code: "missing-mode-value" | "path-conflict" | "unresolved-alias" | "cyclic-alias";
    message: string;
};

/**
 * Contains the generated tree, conversion count, and skipped issues.
 */
export type FigmaToDtcgResult = {
    tree: DtcgTokenTree;
    convertedColorVariableCount: number;
    issues: ConversionIssue[];
};

/**
 * Contains generated trees for multiple modes.
 */
export type FigmaModesToDtcgResult = {
    document: DtcgModesDocument;
    modeResults: DtcgModeResult[];
    convertedColorVariableCount: number;
    issues: ConversionIssue[];
};

export type DtcgModeResult = {
    modeId: string;
    label: string;
    tree: DtcgTokenTree;
};

export type DtcgModesDocument = {
    $metadata: {
        tokenSetOrder: string[];
    };
    $themes: DtcgThemeDefinition[];
    [tokenSetName: string]: DtcgTokenTree | DtcgThemeDefinition[] | { tokenSetOrder: string[] };
};

type DtcgThemeDefinition = {
    id: string;
    name: string;
    selectedTokenSets: Record<string, "enabled">;
};

type SetTokenResult =
    | { ok: true }
    | { ok: false; issue: ConversionIssue };

type ColorVariableCandidate = {
    id: string;
    path: string;
    pathSegments: string[];
    variable: FigmaVariableInput;
    tokenSource: ColorTokenSource;
};

type ColorTokenSource =
    | { kind: "direct"; value: RGBA }
    | {
        kind: "alias";
        targetVariableId: string;
        targetPath: string;
        targetDisplayPath: string;
    };

type ColorCandidateResult =
    | { kind: "candidate"; candidate: ColorVariableCandidate }
    | { kind: "issue"; issue: ConversionIssue }
    | { kind: "skip" };

/**
 * Converts color values and aliases from Figma Variables into one DTCG tree.
 */
export function convertFigmaVariablesToDtcg(
    variables: readonly FigmaVariableInput[],
    selectedMode: FigmaModeSelection,
    aliasLookupVariables: readonly FigmaVariableInput[] = variables,
): FigmaToDtcgResult {
    const variablesById: Map<string, FigmaVariableInput> = createVariablesByIdMap(
        aliasLookupVariables,
    );
    const candidates: ColorVariableCandidate[] = [];
    const issues: ConversionIssue[] = [];

    for (const variable of variables) {
        const candidateResult: ColorCandidateResult = createColorVariableCandidate(
            variable,
            variablesById,
            selectedMode,
        );

        if (candidateResult.kind === "candidate") {
            candidates.push(candidateResult.candidate);
            continue;
        }

        if (candidateResult.kind === "issue") {
            issues.push(candidateResult.issue);
        }
    }

    return buildDtcgTreeFromCandidates(
        candidates,
        issues,
        variablesById,
        selectedMode,
    );
}

/**
 * Converts the same Variable set with the same rules for every selected mode.
 */
export function convertFigmaVariablesToDtcgForModes(
    variables: readonly FigmaVariableInput[],
    selectedModes: readonly FigmaModeSelection[],
    aliasLookupVariables: readonly FigmaVariableInput[] = variables,
): FigmaModesToDtcgResult {
    const tokenSetsByMode: Record<string, DtcgTokenTree> = Object.create(null) as Record<
        string,
        DtcgTokenTree
    >;
    const tokenSetOrder: string[] = [];
    const themes: DtcgThemeDefinition[] = [];
    const modeResults: DtcgModeResult[] = [];
    const issues: ConversionIssue[] = [];
    let convertedColorVariableCount: number = 0;

    for (const selectedMode of selectedModes) {
        const tokenSetName: string = selectedMode.label;
        const modeResult: FigmaToDtcgResult = convertFigmaVariablesToDtcg(
            variables,
            selectedMode,
            aliasLookupVariables,
        );

        tokenSetsByMode[tokenSetName] = modeResult.tree;
        tokenSetOrder.push(tokenSetName);
        modeResults.push({
            modeId: selectedMode.modeId,
            label: selectedMode.label,
            tree: modeResult.tree,
        });
        themes.push({
            id: selectedMode.modeId,
            name: selectedMode.label,
            selectedTokenSets: {
                [tokenSetName]: "enabled",
            },
        });
        convertedColorVariableCount += modeResult.convertedColorVariableCount;
        issues.push(
            ...modeResult.issues.map((issue) =>
                prefixIssueWithMode(issue, selectedMode),
            ),
        );
    }

    return {
        document: createModesDocument(tokenSetsByMode, tokenSetOrder, themes),
        modeResults,
        convertedColorVariableCount,
        issues,
    };
}

function createModesDocument(
    tokenSetsByMode: Record<string, DtcgTokenTree>,
    tokenSetOrder: readonly string[],
    themes: readonly DtcgThemeDefinition[],
): DtcgModesDocument {
    const document: DtcgModesDocument = Object.create(null) as DtcgModesDocument;
    document.$metadata = { tokenSetOrder: [...tokenSetOrder] };
    document.$themes = [...themes];

    for (const tokenSetName of tokenSetOrder) {
        document[tokenSetName] = tokenSetsByMode[tokenSetName]!;
    }

    return document;
}

function createColorVariableCandidate(
    variable: FigmaVariableInput,
    variablesById: ReadonlyMap<string, FigmaVariableInput>,
    selectedMode: FigmaModeSelection,
): ColorCandidateResult {
    if (variable.resolvedType !== "COLOR") {
        return { kind: "skip" };
    }

    const pathSegments: string[] = variable.name.split("/").filter(Boolean);

    if (pathSegments.length === 0) {
        return { kind: "skip" };
    }

    const selectedModeValue: VariableValue | undefined =
        variable.valuesByMode[selectedMode.modeId];

    if (selectedModeValue === undefined) {
        return {
            kind: "issue",
            issue: createMissingModeValueIssue(variable.name, selectedMode),
        };
    }

    if (isRgba(selectedModeValue)) {
        const exportPathSegments: string[] = createExportPathSegments(
            variable.name,
            "direct",
        );

        return {
            kind: "candidate",
            candidate: {
                id: variable.id,
                path: exportPathSegments.join("/"),
                pathSegments: exportPathSegments,
                variable,
                tokenSource: {
                    kind: "direct",
                    value: selectedModeValue,
                },
            },
        };
    }

    if (!isVariableAlias(selectedModeValue)) {
        return { kind: "skip" };
    }

    const exportPathSegments: string[] = createExportPathSegments(
        variable.name,
        "alias",
    );
    const targetVariable: FigmaVariableInput | undefined =
        variablesById.get(selectedModeValue.id);

    return {
        kind: "candidate",
        candidate: {
            id: variable.id,
            path: exportPathSegments.join("/"),
            pathSegments: exportPathSegments,
            variable,
            tokenSource: {
                kind: "alias",
                targetVariableId: selectedModeValue.id,
                targetPath: createAliasTargetPath(
                    targetVariable,
                    selectedMode,
                ),
                targetDisplayPath: targetVariable?.name ?? selectedModeValue.id,
            },
        },
    };
}

function createExportPathSegments(
    variablePath: string,
    sourceKind: ColorTokenSource["kind"],
): string[] {
    const originalSegments: string[] = variablePath.split("/").filter(Boolean);

    if (originalSegments.length === 0) {
        return [];
    }

    if (hasExplicitLayerPrefix(originalSegments)) {
        return originalSegments;
    }

    const inferredLayer: string = sourceKind === "direct"
        ? "primitive"
        : "semantic";

    return [inferredLayer, ...originalSegments];
}

function createAliasTargetPath(
    targetVariable: FigmaVariableInput | undefined,
    selectedMode: FigmaModeSelection,
): string {
    if (targetVariable === undefined || targetVariable.resolvedType !== "COLOR") {
        return "";
    }

    const targetValue: VariableValue | undefined =
        targetVariable.valuesByMode[selectedMode.modeId];

    if (isRgba(targetValue)) {
        return createExportPathSegments(targetVariable.name, "direct").join("/");
    }

    if (isVariableAlias(targetValue)) {
        return createExportPathSegments(targetVariable.name, "alias").join("/");
    }

    return "";
}

function hasExplicitLayerPrefix(pathSegments: readonly string[]): boolean {
    return pathSegments[0] === "primitive"
        || pathSegments[0] === "semantic"
        || pathSegments[0] === "component";
}

function buildDtcgTreeFromCandidates(
    candidates: readonly ColorVariableCandidate[],
    issues: ConversionIssue[],
    variablesById: ReadonlyMap<string, FigmaVariableInput>,
    selectedMode: FigmaModeSelection,
): FigmaToDtcgResult {
    const plannedInsertions: Map<string, SetTokenResult> =
        planCandidateInsertions(candidates);
    const tree: DtcgTokenTree = Object.create(null) as DtcgTokenTree;
    let convertedColorVariableCount: number = 0;

    for (const candidate of candidates) {
        const plannedInsertion: SetTokenResult | undefined =
            plannedInsertions.get(candidate.id);

        if (plannedInsertion === undefined || !plannedInsertion.ok) {
            issues.push(plannedInsertion?.issue ?? createMissingPlanIssue(candidate));
            continue;
        }

        const aliasCycle: string[] | null = findColorAliasCycle(
            candidate,
            variablesById,
            selectedMode,
        );

        if (aliasCycle !== null) {
            issues.push(createCyclicAliasIssue(candidate.path, aliasCycle));
            continue;
        }

        const token: DtcgColorToken | null = createDtcgColorToken(
            candidate,
            plannedInsertions,
            variablesById,
            selectedMode,
        );

        if (token === null) {
            issues.push(createUnresolvedAliasIssue(candidate));
            continue;
        }

        const setTokenResult: SetTokenResult = setTokenAtPath(
            tree,
            candidate.path,
            candidate.pathSegments,
            token,
        );

        if (!setTokenResult.ok) {
            issues.push(setTokenResult.issue);
            continue;
        }

        convertedColorVariableCount += 1;
    }

    return { tree, convertedColorVariableCount, issues };
}

function createVariablesByIdMap(
    variables: readonly FigmaVariableInput[],
): Map<string, FigmaVariableInput> {
    return new Map<string, FigmaVariableInput>(
        variables.map((variable) => [variable.id, variable]),
    );
}

function planCandidateInsertions(
    candidates: readonly ColorVariableCandidate[],
): Map<string, SetTokenResult> {
    const plannedTree: DtcgTokenTree = Object.create(null) as DtcgTokenTree;
    const plannedInsertions: Map<string, SetTokenResult> = new Map();

    for (const candidate of candidates) {
        plannedInsertions.set(
            candidate.id,
            setTokenAtPath(
                plannedTree,
                candidate.path,
                candidate.pathSegments,
                createPlanningToken(),
            ),
        );
    }

    return plannedInsertions;
}

function createDtcgColorToken(
    candidate: ColorVariableCandidate,
    plannedInsertions: ReadonlyMap<string, SetTokenResult>,
    variablesById: ReadonlyMap<string, FigmaVariableInput>,
    selectedMode: FigmaModeSelection,
): DtcgColorToken | null {
    if (candidate.tokenSource.kind === "direct") {
        return {
            $type: "color",
            $value: {
                colorSpace: "srgb",
                components: [
                    candidate.tokenSource.value.r,
                    candidate.tokenSource.value.g,
                    candidate.tokenSource.value.b,
                ],
                alpha: candidate.tokenSource.value.a,
                hex: rgbaToHex(candidate.tokenSource.value),
            },
            ...createDtcgTokenMetadata(candidate.variable),
        };
    }

    if (candidate.tokenSource.targetPath === "") {
        return null;
    }

    const targetInsertion: SetTokenResult | undefined = plannedInsertions.get(
        candidate.tokenSource.targetVariableId,
    );

    if (targetInsertion !== undefined) {
        return targetInsertion.ok
            ? {
                $type: "color",
                $value: createDtcgReference(candidate.tokenSource.targetPath),
                ...createDtcgTokenMetadata(candidate.variable),
            }
            : null;
    }

    const targetVariable: FigmaVariableInput | undefined = variablesById.get(
        candidate.tokenSource.targetVariableId,
    );

    if (!canReferenceExternalColorAliasTarget(targetVariable, selectedMode)) {
        return null;
    }

    return {
        $type: "color",
        $value: createDtcgReference(candidate.tokenSource.targetPath),
        ...createDtcgTokenMetadata(candidate.variable),
    };
}

function findColorAliasCycle(
    candidate: ColorVariableCandidate,
    variablesById: ReadonlyMap<string, FigmaVariableInput>,
    selectedMode: FigmaModeSelection,
): string[] | null {
    if (candidate.tokenSource.kind !== "alias") {
        return null;
    }

    const visitedIndexById: Map<string, number> = new Map([[candidate.id, 0]]);
    const chain: string[] = [candidate.path];
    let currentVariableId: string = candidate.tokenSource.targetVariableId;
    let currentPath: string = candidate.tokenSource.targetPath || candidate.tokenSource.targetDisplayPath;

    while (true) {
        const cycleStartIndex: number | undefined = visitedIndexById.get(currentVariableId);

        if (cycleStartIndex !== undefined) {
            return [...chain.slice(cycleStartIndex), currentPath];
        }

        visitedIndexById.set(currentVariableId, chain.length);
        chain.push(currentPath);

        const currentVariable: FigmaVariableInput | undefined =
            variablesById.get(currentVariableId);

        if (currentVariable === undefined || currentVariable.resolvedType !== "COLOR") {
            return null;
        }

        const currentValue: VariableValue | undefined =
            currentVariable.valuesByMode[selectedMode.modeId];

        if (!isVariableAlias(currentValue)) {
            return null;
        }

        currentVariableId = currentValue.id;
        currentPath = createAliasTargetPath(
            variablesById.get(currentVariableId),
            selectedMode,
        ) || variablesById.get(currentVariableId)?.name || currentVariableId;
    }
}

function createDtcgTokenMetadata(
    variable: FigmaVariableInput,
): Pick<DtcgColorToken, "$description" | "$extensions"> {
    const metadata: Pick<DtcgColorToken, "$description" | "$extensions"> = {};

    if (variable.description.trim() !== "") {
        metadata.$description = variable.description;
    }

    if (hasFigmaExtensions(variable)) {
        metadata.$extensions = {
            "com.figma": {
                hiddenFromPublishing: variable.hiddenFromPublishing,
                remote: variable.remote,
                variableId: variable.id,
                variableCollectionId: variable.variableCollectionId,
                key: variable.key,
                scopes: [...variable.scopes],
                codeSyntax: { ...variable.codeSyntax },
            },
        };
    }

    return metadata;
}

function hasFigmaExtensions(variable: FigmaVariableInput): boolean {
    return variable.hiddenFromPublishing
        || variable.remote
        || variable.scopes.length > 0
        || Object.keys(variable.codeSyntax).length > 0;
}

function createPlanningToken(): DtcgColorToken {
    return {
        $type: "color",
        $value: {
            colorSpace: "srgb",
            components: [0, 0, 0],
            alpha: 1,
        },
    };
}

function createDtcgReference(path: string): DtcgColorReference {
    return `{${path.split("/").filter(Boolean).join(".")}}`;
}

function rgbaToHex(color: RGBA): string {
    return `#${rgbaChannelToHex(color.r)}${rgbaChannelToHex(color.g)}${rgbaChannelToHex(color.b)}`;
}

function rgbaChannelToHex(channel: number): string {
    const value: number = Math.round(clamp01(channel) * 255);
    return value.toString(16).padStart(2, "0");
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function canReferenceExternalColorAliasTarget(
    targetVariable: FigmaVariableInput | undefined,
    selectedMode: FigmaModeSelection,
): boolean {
    if (targetVariable === undefined || targetVariable.resolvedType !== "COLOR") {
        return false;
    }

    const targetValue: VariableValue | undefined =
        targetVariable.valuesByMode[selectedMode.modeId];

    return isRgba(targetValue) || isVariableAlias(targetValue);
}

function createMissingModeValueIssue(
    path: string,
    selectedMode: FigmaModeSelection,
): ConversionIssue {
    return {
        path,
        code: "missing-mode-value",
        message: `Cannot create token at "${path}": selected mode "${selectedMode.label}" has no value for this Variable.`,
    };
}

function createMissingPlanIssue(
    candidate: ColorVariableCandidate,
): ConversionIssue {
    return {
        path: candidate.path,
        code: "unresolved-alias",
        message: `Cannot create token at "${candidate.path}": conversion plan is missing for this Variable.`,
    };
}

function createUnresolvedAliasIssue(
    candidate: ColorVariableCandidate,
): ConversionIssue {
    if (candidate.tokenSource.kind !== "alias") {
        return createMissingPlanIssue(candidate);
    }

    return {
        path: candidate.path,
        code: "unresolved-alias",
        message: `Cannot create token at "${candidate.path}": alias target "${candidate.tokenSource.targetDisplayPath || candidate.tokenSource.targetVariableId}" could not be converted.`,
    };
}

function createCyclicAliasIssue(
    path: string,
    cycle: readonly string[],
): ConversionIssue {
    return {
        path,
        code: "cyclic-alias",
        message: `Cannot create token at "${path}": alias chain contains a cycle (${cycle.join(" -> ")}).`,
    };
}

function isRgba(value: unknown): value is RGBA {
    return value !== undefined
        && value !== null
        && typeof value === "object"
        && !Array.isArray(value)
        && "r" in value
        && typeof value.r === "number"
        && "g" in value
        && typeof value.g === "number"
        && "b" in value
        && typeof value.b === "number"
        && "a" in value
        && typeof value.a === "number";
}

function isVariableAlias(value: unknown): value is VariableAlias {
    return value !== undefined
        && value !== null
        && typeof value === "object"
        && !Array.isArray(value)
        && "type" in value
        && value.type === "VARIABLE_ALIAS"
        && "id" in value
        && typeof value.id === "string";
}

function setTokenAtPath(
    tree: DtcgTokenTree,
    variablePath: string,
    pathSegments: readonly string[],
    token: DtcgColorToken,
): SetTokenResult {
    let currentGroup: DtcgTokenTree = tree;

    for (const [index, pathSegment] of pathSegments.slice(0, -1).entries()) {
        const child: DtcgColorToken | DtcgTokenTree | undefined =
            currentGroup[pathSegment];

        if (child === undefined) {
            const nestedGroup: DtcgTokenTree = Object.create(null) as DtcgTokenTree;
            currentGroup[pathSegment] = nestedGroup;
            currentGroup = nestedGroup;
            continue;
        }

        if (isColorToken(child)) {
            const tokenPath: string = pathSegments.slice(0, index + 1).join("/");
            return pathConflict(
                variablePath,
                `"${tokenPath}" is already a token.`,
            );
        }

        currentGroup = child;
    }

    const tokenName: string = pathSegments[pathSegments.length - 1];
    const existingValue: DtcgColorToken | DtcgTokenTree | undefined =
        currentGroup[tokenName];

    if (existingValue !== undefined) {
        const conflictReason: string = isColorToken(existingValue)
            ? "this path is already used as a token."
            : "this path is already used as a token group.";
        return pathConflict(variablePath, conflictReason);
    }

    currentGroup[tokenName] = token;
    return { ok: true };
}

function pathConflict(path: string, reason: string): SetTokenResult {
    return {
        ok: false,
        issue: {
            path,
            code: "path-conflict",
            message: `Cannot create token at "${path}": ${reason}`,
        },
    };
}

function prefixIssueWithMode(
    issue: ConversionIssue,
    selectedMode: FigmaModeSelection,
): ConversionIssue {
    return {
        path: issue.path,
        code: issue.code,
        message: `[${selectedMode.label}] ${issue.message}`,
    };
}

function isColorToken(
    value: DtcgColorToken | DtcgTokenTree,
): value is DtcgColorToken {
    return "$type" in value && value.$type === "color";
}
