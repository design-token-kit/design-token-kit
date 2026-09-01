import type { ExportedTokenFile } from "#/figma-plugin/token-export/TokenExporter";

/**
 * Reports architecture issues for the expected primitive, semantic, component token layers.
 */
export class TokenArchitectureAnalyzer {

    analyze(files: ExportedTokenFile[]): TokenArchitectureReport {
        const baseFile = files.find((file) => file.fileName === "tokens.json") ?? files[0];
        if (baseFile === undefined) {
            return toReport([
                checkResult(
                    "Token architecture source is available.",
                    "The plugin needs generated tokens before it can check architecture.",
                    "architecture-analysis-in-the-plugin",
                    "error",
                    ["no token architecture source was generated."],
                ),
                checkResult(
                    "Architecture layers are defined",
                    "Layer names show how tokens are organized.",
                    "three-token-levels",
                    "warning",
                    [],
                ),
                checkResult(
                    "References follow the layer order",
                    "semantic -> primitive, component -> semantic",
                    "reference-rule",
                    "warning",
                    [],
                    [],
                    "Use references only in this order: semantic -> primitive, component -> semantic.",
                ),
                checkResult(
                    "Raw values stay in primitive tokens",
                    "Semantic and component tokens should use references.",
                    "primitive",
                    "warning",
                    [],
                    [],
                    "Move raw values to primitive tokens and reference them from semantic or component tokens.",
                ),
                checkResult(
                    "No broken token references",
                    "Every token reference points to an existing token.",
                    "aliases",
                    "error",
                    [],
                    [],
                    "Create the missing token or update the reference.",
                ),
                checkResult(
                    "Component tokens stay independent",
                    "Components should reference semantic tokens, not other components.",
                    "reference-rule",
                    "warning",
                    [],
                    [],
                    "Reference semantic tokens from component tokens.",
                ),
            ]);
        }

        return analyzeDocument(baseFile.tokens, baseFile.architectureWarnings);
    }

}

/**
 * Full architecture analysis result for the Figma plugin UI.
 */
export interface TokenArchitectureReport {
    warnings: string[];
    checks: TokenArchitectureCheckResult[];
}

/**
 * Single named architecture check shown in the Summary panel.
 */
export interface TokenArchitectureCheckResult {
    name: string;
    description: string;
    docsUrl: string;
    passed: boolean;
    severity: TokenArchitectureCheckSeverity;
    issues: string[];
    issueHeading?: string;
    notes: string[];
}

export type TokenArchitectureCheckSeverity = "ok" | "warning" | "error";

const TOKEN_LAYERS = ["primitive", "semantic", "component"] as const;
const FIGMA_PLUGIN_GUIDE_URL = "https://design-token-kit.github.io/docs/guides/figma-plugin/";
const REFERENCE_PATTERN = /\{([^{}]+)\}/g;

type TokenLayer = typeof TOKEN_LAYERS[number];

interface TokenEntry {
    path: string[];
    value: unknown;
}

type TokenArchitectureDocument = Record<string, unknown>;

function analyzeDocument(document: TokenArchitectureDocument, architectureWarnings: string[]): TokenArchitectureReport {
    const tokens = collectTokens(document);
    const tokenPathSet = new Set(tokens.map((token) => toPathName(token.path)));
    const referenceIssues = checkTokenReferences(tokens, tokenPathSet);
    const layerIssues = checkArchitectureLayers(document, architectureWarnings);
    const checks = [
        checkResult(
            "Architecture layers are defined",
            formatDetectedLayers(tokens),
            "three-token-levels",
            "warning",
            layerIssues,
            [],
            toAliasIssueHeading(architectureWarnings),
        ),
        checkResult(
            "References follow the layer order",
            "semantic -> primitive, component -> semantic",
            "reference-rule",
            "warning",
            referenceIssues.layerIssues,
            [],
            "Use references only in this order: semantic -> primitive, component -> semantic.",
        ),
        checkResult(
            "Raw values stay in primitive tokens",
            "Semantic and component tokens should use references.",
            "primitive",
            "warning",
            checkTokenValues(tokens),
            [],
            "Move raw values to primitive tokens and reference them from semantic or component tokens.",
        ),
        checkResult(
            "No broken token references",
            "Every token reference points to an existing token.",
            "aliases",
            "error",
            referenceIssues.missingReferenceIssues,
            [],
            "Create the missing token or update the reference.",
        ),
        checkResult(
            "Component tokens stay independent",
            "Components should reference semantic tokens, not other components.",
            "reference-rule",
            "warning",
            referenceIssues.componentIsolationIssues,
            [],
            "Reference semantic tokens from component tokens.",
        ),
    ];

    return toReport(checks);
}

function checkArchitectureLayers(document: TokenArchitectureDocument, architectureWarnings: string[]): string[] {
    const detectedLayers = TOKEN_LAYERS.filter((layer) => isRecord(document[layer]));
    const noDetectedLayerIssues = detectedLayers.length === 0
        ? ["No primitive, semantic, or component layer was found."]
        : [];

    return [
        ...noDetectedLayerIssues,
        ...summarizeArchitectureWarnings(architectureWarnings),
    ];
}

function checkTokenValues(tokens: TokenEntry[]): string[] {
    const rawValueTokenPaths = tokens.flatMap((token) => {
        const layer = toTokenLayer(token.path);
        if (layer === "primitive" || layer === undefined || !hasRawValueLeaf(token.value)) {
            return [];
        }

        return [toPathName(token.path)];
    });

    return summarizeTokenPaths(
        rawValueTokenPaths,
        (path) => `"${path}" uses a raw value outside primitive tokens.`,
        (path, count) => `"${path}" and ${count - 1} more tokens use raw values outside primitive tokens.`,
    );
}

function checkTokenReferences(tokens: TokenEntry[], tokenPathSet: Set<string>): ReferenceIssues {
    const issues: ReferenceIssues = {
        missingReferenceIssues: [],
        layerIssues: [],
        componentIsolationIssues: [],
    };

    for (const token of tokens) {
        for (const referencePath of extractReferencePaths(token.value)) {
            const referenceName = toPathName(referencePath);
            if (!tokenPathSet.has(referenceName)) {
                issues.missingReferenceIssues.push(toPathName(token.path));
            }

            const layerIssue = checkLayerReference(token.path, referencePath);
            if (layerIssue !== undefined) {
                issues.layerIssues.push(layerIssue);
            }

            const isolationIssue = checkComponentIsolation(token.path, referencePath);
            if (isolationIssue !== undefined) {
                issues.componentIsolationIssues.push(isolationIssue);
            }
        }
    }

    return {
        missingReferenceIssues: summarizeTokenPaths(
            issues.missingReferenceIssues,
            (path) => `"${path}" references a missing token.`,
            (path, count) => `"${path}" and ${count - 1} more tokens reference missing tokens.`,
        ),
        layerIssues: summarizeTokenPaths(
            issues.layerIssues,
            (path) => `"${path}" references a token outside the allowed layer order.`,
            (path, count) => `"${path}" and ${count - 1} more tokens reference tokens outside the allowed layer order.`,
        ),
        componentIsolationIssues: summarizeTokenPaths(
            issues.componentIsolationIssues,
            (path) => `"${path}" references another component token.`,
            (path, count) => `"${path}" and ${count - 1} more tokens reference another component token.`,
        ),
    };
}

function checkLayerReference(tokenPath: string[], referencePath: string[]): string | undefined {
    const fromLayer = toTokenLayer(tokenPath);
    const toLayer = toTokenLayer(referencePath);
    if (fromLayer === undefined || toLayer === undefined || isAllowedLayerReference(fromLayer, toLayer)) {
        return undefined;
    }

    return toPathName(tokenPath);
}

function checkComponentIsolation(tokenPath: string[], referencePath: string[]): string | undefined {
    if (tokenPath[0] !== "component" || referencePath[0] !== "component") {
        return undefined;
    }

    const componentName = tokenPath[1];
    const referencedComponentName = referencePath[1];
    if (componentName === undefined || referencedComponentName === undefined || componentName === referencedComponentName) {
        return undefined;
    }

    return toPathName(tokenPath);
}

function collectTokens(value: unknown, path: string[] = []): TokenEntry[] {
    if (!isRecord(value)) {
        return [];
    }

    if ("$type" in value && "$value" in value) {
        return [{ path, value: value.$value }];
    }

    return Object.entries(value).flatMap(([key, child]) => collectTokens(child, [...path, key]));
}

function hasRawValueLeaf(value: unknown): boolean {
    if (typeof value === "string") {
        return !isReferenceValue(value);
    }

    if (Array.isArray(value)) {
        return value.some((item) => hasRawValueLeaf(item));
    }

    if (isRecord(value)) {
        return Object.values(value).some((child) => hasRawValueLeaf(child));
    }

    return value !== undefined;
}

function isReferenceValue(value: string): boolean {
    return /^\{[^{}]+\}$/.test(value);
}

function extractReferencePaths(value: unknown): string[][] {
    if (typeof value === "string") {
        return Array.from(value.matchAll(REFERENCE_PATTERN), (match) => match[1]!.split("."));
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => extractReferencePaths(item));
    }

    if (isRecord(value)) {
        return Object.values(value).flatMap((child) => extractReferencePaths(child));
    }

    return [];
}

function toTokenLayer(path: string[]): TokenLayer | undefined {
    return TOKEN_LAYERS.find((layer) => layer === path[0]);
}

function isAllowedLayerReference(fromLayer: TokenLayer, toLayer: TokenLayer): boolean {
    return (fromLayer === "semantic" && toLayer === "primitive")
        || (fromLayer === "component" && toLayer === "semantic");
}

function toPathName(path: string[]): string {
    return path.join(".");
}

function summarizeTokenPaths(
    paths: string[],
    formatSingleIssue: (path: string) => string,
    formatGroupedIssue: (path: string, count: number) => string,
): string[] {
    const uniquePaths = Array.from(new Set(paths));
    const firstPath = uniquePaths[0];
    if (firstPath === undefined) {
        return [];
    }

    return [uniquePaths.length === 1
        ? formatSingleIssue(firstPath)
        : formatGroupedIssue(firstPath, uniquePaths.length)];
}

function checkResult(
    name: string,
    description: string,
    docsAnchor: string,
    failedSeverity: Exclude<TokenArchitectureCheckSeverity, "ok">,
    issues: string[],
    notes: string[] = [],
    issueHeading: string | undefined = undefined,
): TokenArchitectureCheckResult {
    return {
        name,
        description,
        docsUrl: `${FIGMA_PLUGIN_GUIDE_URL}#${docsAnchor}`,
        passed: issues.length === 0,
        severity: issues.length === 0 ? "ok" : failedSeverity,
        issues,
        issueHeading,
        notes,
    };
}

function toReport(checks: TokenArchitectureCheckResult[]): TokenArchitectureReport {
    const warnings = checks.flatMap((check) => check.issues.map((issue) => `Token architecture: ${issue}`));

    return {
        checks,
        warnings: Array.from(new Set(warnings)),
    };
}

function summarizeArchitectureWarnings(warnings: string[]): string[] {
    const warningsByAlias = new Map<string, AliasWarningGroup>();

    for (const warning of warnings) {
        const match = /^(.+) uses architecture layer alias "([^"]+)"; prefer canonical layer "([^"]+)"\.$/.exec(warning);
        if (match === null) {
            continue;
        }

        const [, path, alias, canonicalLayer] = match;
        const key = `${alias}->${canonicalLayer}`;
        const existing = warningsByAlias.get(key);
        if (existing !== undefined) {
            existing.count += 1;
            continue;
        }

        warningsByAlias.set(key, {
            path: path!,
            alias: alias!,
            canonicalLayer: canonicalLayer!,
            count: 1,
        });
    }

    return Array.from(warningsByAlias.values()).map(formatAliasWarningGroup);
}

function toAliasIssueHeading(warnings: string[]): string | undefined {
    const warning = warnings.find((value) =>
        /^(.+) uses architecture layer alias "([^"]+)"; prefer canonical layer "([^"]+)"\.$/.test(value),
    );
    const match = warning === undefined
        ? null
        : /^(.+) uses architecture layer alias "([^"]+)"; prefer canonical layer "([^"]+)"\.$/.exec(warning);

    return match === null ? undefined : `Prefer the canonical layer name "${match[3]}".`;
}

function formatAliasWarningGroup(group: AliasWarningGroup): string {
    if (group.count === 1) {
        return `"${group.path}" uses the alias "${group.alias}".`;
    }

    return `"${group.path}" and ${group.count - 1} more tokens use the alias "${group.alias}".`;
}

function formatDetectedLayers(tokens: TokenEntry[]): string {
    const detectedLayers = TOKEN_LAYERS.filter((layer) => tokens.some((token) => token.path[0] === layer));
    if (detectedLayers.length === 0) {
        return "No primitive, semantic, or component layers were found.";
    }

    return `Detected layers: ${detectedLayers.join(", ")}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface AliasWarningGroup {
    path: string;
    alias: string;
    canonicalLayer: string;
    count: number;
}

interface ReferenceIssues {
    missingReferenceIssues: string[];
    layerIssues: string[];
    componentIsolationIssues: string[];
}
