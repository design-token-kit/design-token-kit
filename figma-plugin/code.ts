import {
    convertDtcgArtifactsToCssWithCore,
    type CoreRuntimeIssue,
    validateDtcgArtifactsWithCore,
} from "./figma-core-runtime";
import {
    createDtcgPreviewFromArtifacts,
    createMultiModeDtcgExportArtifacts,
    createSingleModeDtcgExportArtifact,
    type DtcgExportArtifact,
} from "./figma-dtcg-export";
import {
    convertFigmaVariablesToDtcg,
    convertFigmaVariablesToDtcgForModes,
    type ConversionIssue,
    type FigmaModeSelection,
    type FigmaModesToDtcgResult,
    type FigmaToDtcgResult,
} from "./figma-to-dtcg";

figma.showUI(__html__, {
    width: 480,
    height: 640,
});

type FigmaModeOption = {
    modeId: string;
    modeName: string;
    isDefault: boolean;
};

type FigmaCollectionOption = {
    collectionId: string;
    collectionName: string;
    modeOptions: FigmaModeOption[];
    isDefault: boolean;
};

type FigmaFileDiagnostics = {
    localCollectionCount: number;
    localVariableCount: number;
    localPaintStyleCount: number;
    localTextStyleCount: number;
    localEffectStyleCount: number;
    localGridStyleCount: number;
    libraryVariableCollectionCount: number;
};

type PluginMessage =
    | { type: "LOAD_COLLECTIONS" }
    | {
        type: "READ_VARIABLES";
        selectedCollectionId: string;
        selectedModeId: string;
    }
    | {
        type: "READ_ALL_MODES";
        selectedCollectionId: string;
    };

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === "LOAD_COLLECTIONS") {
        await loadCollections();
        return;
    }

    if (msg.type === "READ_VARIABLES") {
        await readVariables(msg.selectedCollectionId, msg.selectedModeId);
        return;
    }

    if (msg.type === "READ_ALL_MODES") {
        await readAllModes(msg.selectedCollectionId);
    }
};

async function loadCollections(): Promise<void> {
    try {
        const diagnostics: FigmaFileDiagnostics = await getFileDiagnostics();
        const collectionOptions: FigmaCollectionOption[] =
            await getCollectionOptions();
        const selectedCollectionId: string | null =
            getDefaultCollectionId(collectionOptions);
        const selectedCollection: FigmaCollectionOption | null =
            resolveCollectionSelection(collectionOptions, selectedCollectionId);
        const selectedModeId: string | null =
            selectedCollection === null
                ? null
                : getDefaultModeId(selectedCollection.modeOptions);

        figma.ui.postMessage({
            type: "COLLECTIONS_LOADED",
            payload: {
                collectionOptions,
                selectedCollectionId,
                selectedModeId,
                diagnostics,
            },
        });
    } catch (error: unknown) {
        const message: string = getVariablesLoadErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "COLLECTIONS_LOAD_FAILED",
            payload: { message },
        });
    }
}

async function readVariables(
    selectedCollectionId: string,
    selectedModeId: string,
): Promise<void> {
    try {
        const collectionOptions: FigmaCollectionOption[] =
            await getCollectionOptions();
        const selectedCollection: FigmaCollectionOption | null =
            resolveCollectionSelection(collectionOptions, selectedCollectionId);

        if (selectedCollection === null) {
            throw new Error("Select a variable collection before reading Variables.");
        }

        const selectedMode: FigmaModeSelection | null = resolveSelectedMode(
            selectedCollection.modeOptions,
            selectedModeId,
        );

        if (selectedMode === null) {
            throw new Error("Select a variable mode before reading Variables.");
        }

        const variables: Variable[] =
            await figma.variables.getLocalVariablesAsync();
        const collectionVariables: Variable[] = variables.filter(
            (variable) =>
                variable.variableCollectionId === selectedCollection.collectionId,
        );
        const conversionResult: FigmaToDtcgResult =
            convertFigmaVariablesToDtcg(collectionVariables, selectedMode, variables);
        const exportArtifacts: DtcgExportArtifact[] = [
            createSingleModeDtcgExportArtifact(
                selectedCollection.collectionName,
                selectedMode,
                conversionResult.tree,
            ),
        ];
        const runtimeIssues: Array<ConversionIssue | CoreRuntimeIssue> = [
            ...conversionResult.issues,
            ...validateDtcgArtifactsWithCore(exportArtifacts).issues,
        ];

        figma.notify(
            `Variables: ${collectionVariables.length}. Collection: ${selectedCollection.collectionName}. Mode: ${selectedMode.label}`,
        );

        figma.ui.postMessage({
            type: "VARIABLES_LOADED",
            payload: {
                variableCount: collectionVariables.length,
                convertedColorVariableCount:
                    conversionResult.convertedColorVariableCount,
                issueCount: runtimeIssues.length,
                issues: runtimeIssues,
                dtcgTree: createDtcgPreviewFromArtifacts(exportArtifacts),
                exportArtifacts,
                selectedCollectionName: selectedCollection.collectionName,
                selectedModeLabel: selectedMode.label,
                exportLabel: selectedMode.label,
            },
        });
    } catch (error: unknown) {
        const message: string = getVariablesLoadErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "VARIABLES_LOAD_FAILED",
            payload: { message },
        });
    }
}

async function readAllModes(selectedCollectionId: string): Promise<void> {
    try {
        const collectionOptions: FigmaCollectionOption[] =
            await getCollectionOptions();
        const selectedCollection: FigmaCollectionOption | null =
            resolveCollectionSelection(collectionOptions, selectedCollectionId);

        if (selectedCollection === null) {
            throw new Error("Select a variable collection before reading Variables.");
        }

        const selectedModes: FigmaModeSelection[] =
            getSelectedModesForExport(selectedCollection.modeOptions);

        if (selectedModes.length === 0) {
            throw new Error("The selected variable collection has no modes.");
        }

        const variables: Variable[] =
            await figma.variables.getLocalVariablesAsync();
        const collectionVariables: Variable[] = variables.filter(
            (variable) =>
                variable.variableCollectionId === selectedCollection.collectionId,
        );
        const conversionResult: FigmaModesToDtcgResult =
            convertFigmaVariablesToDtcgForModes(
                collectionVariables,
                selectedModes,
                variables,
            );
        const exportArtifacts: DtcgExportArtifact[] =
            createMultiModeDtcgExportArtifacts(
                selectedCollection.collectionName,
                conversionResult.modeResults,
            );
        const runtimeIssues: Array<ConversionIssue | CoreRuntimeIssue> = [
            ...conversionResult.issues,
            ...validateDtcgArtifactsWithCore(exportArtifacts).issues,
        ];

        figma.notify(
            `Variables: ${collectionVariables.length}. Collection: ${selectedCollection.collectionName}. Modes: ${selectedModes.length}`,
        );

        figma.ui.postMessage({
            type: "VARIABLES_LOADED",
            payload: {
                variableCount: collectionVariables.length,
                convertedColorVariableCount:
                    conversionResult.convertedColorVariableCount,
                issueCount: runtimeIssues.length,
                issues: runtimeIssues,
                dtcgTree: createDtcgPreviewFromArtifacts(exportArtifacts),
                exportArtifacts,
                selectedCollectionName: selectedCollection.collectionName,
                selectedModeLabel: "All modes",
                exportLabel: "all-modes",
            },
        });
    } catch (error: unknown) {
        const message: string = getVariablesLoadErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "VARIABLES_LOAD_FAILED",
            payload: { message },
        });
    }
}

async function getCollectionOptions(): Promise<FigmaCollectionOption[]> {
    const collections: VariableCollection[] =
        await figma.variables.getLocalVariableCollectionsAsync();

    return collections.map((collection, index) => ({
        collectionId: collection.id,
        collectionName: collection.name,
        modeOptions: collection.modes.map((mode) => ({
            modeId: mode.modeId,
            modeName: mode.name,
            isDefault: collection.defaultModeId === mode.modeId,
        })),
        isDefault: index === 0,
    }));
}

async function getFileDiagnostics(): Promise<FigmaFileDiagnostics> {
    const [
        localVariables,
        localCollections,
        localPaintStyles,
        localTextStyles,
        localEffectStyles,
        localGridStyles,
        libraryVariableCollections,
    ] = await Promise.all([
        figma.variables.getLocalVariablesAsync(),
        figma.variables.getLocalVariableCollectionsAsync(),
        figma.getLocalPaintStylesAsync(),
        figma.getLocalTextStylesAsync(),
        figma.getLocalEffectStylesAsync(),
        figma.getLocalGridStylesAsync(),
        getAvailableLibraryVariableCollections(),
    ]);

    return {
        localCollectionCount: localCollections.length,
        localVariableCount: localVariables.length,
        localPaintStyleCount: localPaintStyles.length,
        localTextStyleCount: localTextStyles.length,
        localEffectStyleCount: localEffectStyles.length,
        localGridStyleCount: localGridStyles.length,
        libraryVariableCollectionCount: libraryVariableCollections.length,
    };
}

async function getAvailableLibraryVariableCollections(): Promise<LibraryVariableCollection[]> {
    if (typeof figma.teamLibrary?.getAvailableLibraryVariableCollectionsAsync !== "function") {
        return [];
    }

    return figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
}

function getDefaultCollectionId(
    collectionOptions: readonly FigmaCollectionOption[],
): string | null {
    const defaultCollection: FigmaCollectionOption | undefined =
        collectionOptions.find(
            (collectionOption) => collectionOption.isDefault,
        );

    return (
        defaultCollection?.collectionId
        ?? collectionOptions[0]?.collectionId
        ?? null
    );
}

function getDefaultModeId(
    modeOptions: readonly FigmaModeOption[],
): string | null {
    const defaultMode: FigmaModeOption | undefined = modeOptions.find(
        (modeOption) => modeOption.isDefault,
    );

    return defaultMode?.modeId ?? modeOptions[0]?.modeId ?? null;
}

function getSelectedModesForExport(
    modeOptions: readonly FigmaModeOption[],
): FigmaModeSelection[] {
    const defaultMode: FigmaModeOption | undefined = modeOptions.find(
        (modeOption) => modeOption.isDefault,
    );
    const orderedModeOptions: FigmaModeOption[] = defaultMode === undefined
        ? [...modeOptions]
        : [
            defaultMode,
            ...modeOptions.filter((modeOption) => modeOption.modeId !== defaultMode.modeId),
        ];

    return orderedModeOptions.map((modeOption) => ({
        modeId: modeOption.modeId,
        label: modeOption.modeName,
    }));
}

function resolveCollectionSelection(
    collectionOptions: readonly FigmaCollectionOption[],
    selectedCollectionId: string | null,
): FigmaCollectionOption | null {
    if (selectedCollectionId === null) {
        return null;
    }

    const matchingCollection: FigmaCollectionOption | undefined =
        collectionOptions.find(
            (collectionOption) =>
                collectionOption.collectionId === selectedCollectionId,
        );

    return matchingCollection ?? null;
}

function resolveSelectedMode(
    modeOptions: readonly FigmaModeOption[],
    selectedModeId: string,
): FigmaModeSelection | null {
    const matchingMode: FigmaModeOption | undefined = modeOptions.find(
        (modeOption) => modeOption.modeId === selectedModeId,
    );

    if (matchingMode === undefined) {
        return null;
    }

    return {
        modeId: matchingMode.modeId,
        label: matchingMode.modeName,
    };
}

function getVariablesLoadErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim() !== "") {
        return error.message;
    }

    if (typeof error === "string" && error.trim() !== "") {
        return error;
    }

    return "An unknown error occurred while reading Variables.";
}

Object.assign(globalThis, {
    convertFigmaVariablesToDtcg,
    convertFigmaVariablesToDtcgForModes,
    createSingleModeDtcgExportArtifact,
    createMultiModeDtcgExportArtifacts,
    createDtcgPreviewFromArtifacts,
    validateDtcgArtifactsWithCore,
    convertDtcgArtifactsToCssWithCore,
});
