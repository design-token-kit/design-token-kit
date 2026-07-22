import type { DtcgModeResult, DtcgTokenTree, FigmaModeSelection } from "./figma-to-dtcg";

const DTCG_SCHEMA_URL = "https://www.designtokens.org/schemas/2025.10/format.json";

export type DtcgDocument = {
    $schema: string;
    [name: string]: unknown;
};

export type DtcgExportArtifact = {
    fileName: string;
    content: string;
    document: DtcgDocument;
    isBase: boolean;
    modeId: string;
    modeLabel: string;
};

export type DtcgExportPreview = DtcgDocument | Record<string, DtcgDocument>;

export function createSingleModeDtcgExportArtifact(
    collectionName: string,
    selectedMode: FigmaModeSelection,
    tree: DtcgTokenTree,
): DtcgExportArtifact {
    return createDtcgExportArtifact(
        createSingleModeFileName(collectionName, selectedMode.label),
        selectedMode,
        tree,
        false,
    );
}

export function createMultiModeDtcgExportArtifacts(
    collectionName: string,
    modeResults: readonly DtcgModeResult[],
): DtcgExportArtifact[] {
    const collectionSlug: string = slugifyExportValue(collectionName);
    const usedThemeSlugs: Set<string> = new Set();

    return modeResults.map((modeResult, index) => {
        const isBase: boolean = index === 0;
        const fileName: string = isBase
            ? `${collectionSlug}.dtcg.json`
            : createThemeFileName(
                collectionSlug,
                modeResult.label,
                modeResult.modeId,
                usedThemeSlugs,
            );

        return createDtcgExportArtifact(
            fileName,
            { modeId: modeResult.modeId, label: modeResult.label },
            modeResult.tree,
            isBase,
        );
    });
}

export function createDtcgPreviewFromArtifacts(
    artifacts: readonly DtcgExportArtifact[],
): DtcgExportPreview {
    if (artifacts.length === 1) {
        return artifacts[0]!.document;
    }

    return Object.fromEntries(
        artifacts.map((artifact) => [artifact.fileName, artifact.document]),
    ) as Record<string, DtcgDocument>;
}

function createDtcgExportArtifact(
    fileName: string,
    selectedMode: FigmaModeSelection,
    tree: DtcgTokenTree,
    isBase: boolean,
): DtcgExportArtifact {
    const document: DtcgDocument = createDtcgDocument(tree);

    return {
        fileName,
        content: JSON.stringify(document, null, 2),
        document,
        isBase,
        modeId: selectedMode.modeId,
        modeLabel: selectedMode.label,
    };
}

function createDtcgDocument(tree: DtcgTokenTree): DtcgDocument {
    return {
        $schema: DTCG_SCHEMA_URL,
        ...tree,
    };
}

function createSingleModeFileName(
    collectionName: string,
    modeLabel: string,
): string {
    return `${slugifyExportValue(collectionName)}.${slugifyExportValue(modeLabel)}.dtcg.json`;
}

function createThemeFileName(
    collectionSlug: string,
    modeLabel: string,
    modeId: string,
    usedThemeSlugs: Set<string>,
): string {
    const preferredSlug: string = slugifyExportValue(modeLabel);
    const modeIdSlug: string = slugifyExportValue(modeId);
    let slug: string = preferredSlug;

    if (usedThemeSlugs.has(slug)) {
        slug = `${preferredSlug}-${modeIdSlug}`;
    }

    let uniqueSlug: string = slug;
    let duplicateIndex: number = 2;

    while (usedThemeSlugs.has(uniqueSlug)) {
        uniqueSlug = `${slug}-${duplicateIndex}`;
        duplicateIndex += 1;
    }

    usedThemeSlugs.add(uniqueSlug);
    return `${collectionSlug}.${uniqueSlug}.dtcg.json`;
}

function slugifyExportValue(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "tokens";
}
