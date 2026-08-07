/**
 * Imports DTCG token documents into the current Figma file.
 *
 * Mirrors `token-export/TokenExporter`: the exporter turns Figma entities into
 * DTCG documents, this importer turns DTCG documents into Figma entities.
 */

import {
    applyImportPlan,
    type ImportStrategy,
    type WriteCounts,
} from "#/figma-plugin/token-import/FigmaVariableWriter";
import {
    buildImportPlan,
    type SkippedToken,
    type TokenDocument,
} from "#/figma-plugin/token-import/TokenImportPlan";

export class TokenImporter {
    async import(request: TokenImportRequest): Promise<TokenImportResult> {
        const { documents, warnings } = parseDocuments(request.files);
        if (documents.length === 0) {
            throw new Error("No readable token documents were provided.");
        }

        const plan = buildImportPlan(documents);
        const written = await applyImportPlan(plan, request.strategy);

        return {
            summary: {
                ...written.counts,
                collections: [...plan.collections.keys()],
                modes: toUniqueModes(plan.collections),
                skippedCount: plan.skipped.length,
            },
            skipped: plan.skipped,
            warnings: [...warnings, ...plan.warnings, ...written.warnings],
        };
    }
}

export interface TokenImportRequest {
    files: TokenImportFile[];
    strategy: ImportStrategy;
}

export interface TokenImportFile {
    fileName: string;
    /** Raw file contents; parsed here so a parse error names the file. */
    content: string;
}

export interface TokenImportResult {
    summary: TokenImportSummary;
    /** Tokens Figma cannot represent, grouped by the caller for display. */
    skipped: SkippedToken[];
    warnings: string[];
}

export interface TokenImportSummary extends WriteCounts {
    collections: string[];
    modes: string[];
    skippedCount: number;
}

/**
 * Parses the uploaded files, keeping the base document first.
 *
 * The base document defines the collection default mode, so `tokens.json` must
 * lead regardless of the order the files were selected in.
 */
function parseDocuments(files: TokenImportFile[]): {
    documents: TokenDocument[];
    warnings: string[];
} {
    const documents: TokenDocument[] = [];
    const warnings: string[] = [];

    for (const file of files) {
        try {
            documents.push({ fileName: file.fileName, content: JSON.parse(file.content) });
        } catch (error: unknown) {
            warnings.push(
                `${file.fileName}: file is not valid JSON. `
                + (error instanceof Error ? error.message : String(error)),
            );
        }
    }

    documents.sort((left, right) => Number(isTheme(left.fileName)) - Number(isTheme(right.fileName)));

    return { documents, warnings };
}

function isTheme(fileName: string): boolean {
    return /^tokens\.[^.]+\.json$/i.test(fileName.trim());
}

function toUniqueModes(collections: Map<string, string[]>): string[] {
    const modes = new Set<string>();
    for (const names of collections.values()) {
        for (const name of names) {
            modes.add(name);
        }
    }

    return [...modes];
}
