import type { CheckIssue } from "@design-token-kit/core/core/check/CheckIssue";
import { CheckRunner } from "@design-token-kit/core/core/check/CheckRunner";
import { lintingChecks, validationChecks } from "@design-token-kit/core/core/check/checks/Checks";
import type { DtcgList } from "@design-token-kit/core/core/model/DtcgList";

const FIGMA_PLUGIN_GUIDE_URL = "https://design-token-kit.github.io/docs/guides/figma-plugin/";
const COMPATIBILITY_CHECK_IDS = new Set([
    "root-layer",
    "layer-reference",
    "raw-value-usage",
    "bad-reference",
]);
const LAYER_ALIAS_FAILED_NAME = "Non-canonical layer names";
const ARCHITECTURE_ALIAS_PATTERN =/^(.+) uses architecture layer alias "([^"]+)"; prefer canonical layer "([^"]+)"\.$/;

const CARD_DEFINITIONS: readonly CardDefinition[] = [
    {
        id: "root-layer",
        issueIds: ["root-layer"],
        name: "Architecture layers are defined",
        failedName: "Tokens outside architecture layers",
        description: "Token paths start with a configured root layer.",
        compatibilitySeverity: "warning",
        issueHeading: "Use primitive, semantic, or component as the root layer.",
    },
    {
        id: "layer-reference",
        issueIds: ["layer-reference"],
        name: "References follow the layer order",
        failedName: "Invalid layer references",
        issueFilter: (issue) => !isComponentReferenceIssue(issue),
        description: "Allowed references: semantic → primitive and component → semantic. References within the same layer are not allowed.",
        compatibilitySeverity: "warning",
        issueHeading: "Use a raw value or update the token structure to follow the allowed layer dependencies.",
    },
    {
        id: "raw-value-usage",
        issueIds: ["raw-value-usage"],
        name: "Raw values stay in primitive tokens",
        description: "Semantic and component tokens should use references.",
        compatibilitySeverity: "warning",
        issueHeading: "Move raw values to primitive tokens and reference them from semantic or component tokens.",
    },
    {
        id: "bad-reference",
        issueIds: ["bad-reference", "ref-to-group", "circular-reference", "deprecated-reference"],
        name: "No broken token references",
        description: "Every token reference points to an existing, valid token.",
        issueHeading: "Create the missing token or update the reference.",
    },
    {
        id: "component-isolation",
        issueIds: ["layer-reference"],
        issueFilter: isComponentReferenceIssue,
        name: "Component tokens stay independent",
        description: "Components should reference semantic tokens, not other components.",
        compatibilitySeverity: "warning",
        issueHeading: "Reference semantic tokens from component tokens.",
    },
    {
        id: "type-mismatch",
        issueIds: ["type-mismatch"],
        name: "Token aliases keep their type",
        description: "Aliases resolve to tokens with a compatible type.",
    },
    {
        id: "gradient-duplicate-stop",
        issueIds: ["gradient-duplicate-stop"],
        name: "Gradient stops are unambiguous",
        description: "Gradient stops use distinct positions.",
    },
    {
        id: "empty-group",
        issueIds: ["empty-group"],
        name: "Token groups are not empty",
        description: "Named groups contain tokens or child groups.",
    },
    {
        id: "missing-description",
        issueIds: ["missing-description"],
        name: "Tokens have descriptions",
        failedName: "Missing token descriptions",
        description: "Tokens should have a non-empty $description to improve clarity and maintainability.",
        issueHeading: "Add a description in the variable settings in Figma, then run the analysis again.",
    },
    {
        id: "bad-tailwind-namespace",
        issueIds: ["bad-tailwind-namespace"],
        name: "Tailwind namespaces are valid",
        description: "Tailwind namespace extensions use supported values.",
    },
    {
        id: "bad-rem-base",
        issueIds: ["bad-rem-base"],
        name: "The rem base is valid",
        description: "The rem base extension uses a positive number.",
    },
];

const NO_SOURCE_ISSUE: CheckIssue = {
    id: "dtcg-reader",
    message: "The plugin needs generated tokens before it can check architecture.",
    severity: "error",
};

export class TokenCheckAnalyzer {

    /**
     * Runs core checks and adapts their diagnostics to the plugin's cards.
     */
    analyze(
        list: DtcgList | undefined,
        readIssues: CheckIssue[],
        architectureWarnings: string[] = [],
        runFullLinting = false,
    ): TokenCheckReport {
        const checks = runFullLinting
            ? [...validationChecks(), ...lintingChecks()]
            : [...validationChecks(), ...lintingChecks()].filter((check) => COMPATIBILITY_CHECK_IDS.has(check.id));
        const issues = list === undefined ? [] : new CheckRunner(checks).runList(list);
        const readCardIssues = list === undefined && readIssues.length === 0
            ? [NO_SOURCE_ISSUE]
            : readIssues;
        const cards = [
            ...(readCardIssues.length === 0
                ? []
                : [toCard("dtcg-reader", "Token files are readable", "Generated token files are valid DTCG documents.", readCardIssues)]),
            ...CARD_DEFINITIONS.map((definition) => toCard(
                definition.id,
                definition.name,
                definition.id === "root-layer" ? toArchitectureDescription(list) : definition.description,
                issues.filter((issue) => definition.issueIds.includes(issue.id)
                    && (definition.issueFilter === undefined || definition.issueFilter(issue))),
                definition.issueHeading,
                runFullLinting ? undefined : definition.compatibilitySeverity,
                definition.failedName,
            )).filter((_card, index) => {
                const definition = CARD_DEFINITIONS[index];
                return definition === undefined || runFullLinting || definition.issueIds.some((id) => checks.some((check) => check.id === id));
            }),
        ];
        const remainingWarnings = applyArchitectureWarnings(cards, architectureWarnings);

        return {
            checks: cards,
            warnings: remainingWarnings,
        };
    }

}

/**
 * Core check results and plugin-only warnings shown by the analysis panel.
 */
export interface TokenCheckReport {
    checks: TokenCheckCard[];
    warnings: string[];
}

/**
 * A single analysis card rendered by the plugin UI.
 */
export interface TokenCheckCard {
    name: string;
    description: string;
    docsUrl: string;
    passed: boolean;
    severity: TokenCheckSeverity;
    issues: string[];
    issueHeading?: string;
    notes: string[];
}

export type TokenCheckSeverity = "ok" | "warning" | "error";

interface CardDefinition {
    id: string;
    issueIds: readonly string[];
    name: string;
    /** Problem-oriented title shown instead of {@link name} when the check fails. */
    failedName?: string;
    description: string;
    issueHeading?: string;
    issueFilter?: (issue: CheckIssue) => boolean;
    compatibilitySeverity?: TokenCheckSeverity;
}

function toCard(
    id: string,
    name: string,
    description: string,
    issues: CheckIssue[],
    issueHeading?: string,
    preferredSeverity?: TokenCheckSeverity,
    failedName?: string,
): TokenCheckCard {
    const passed = issues.length === 0;
    return {
        name: passed ? name : failedName ?? name,
        description,
        docsUrl: `${FIGMA_PLUGIN_GUIDE_URL}#${id}`,
        passed,
        severity: passed ? "ok" : preferredSeverity ?? toFailureSeverity(issues),
        issues: summarizeIssues(issues),
        issueHeading,
        notes: [],
    };
}

function toFailureSeverity(issues: CheckIssue[]): Exclude<TokenCheckSeverity, "ok"> {
    return issues.some((issue) => issue.severity === "error") ? "error" : "warning";
}

function isComponentReferenceIssue(issue: CheckIssue): boolean {
    return /^component\..+ \(component\) references .+ \(component\);/.test(issue.message);
}

function toArchitectureDescription(list: DtcgList | undefined): string {
    if (list === undefined) {
        return "Layer names show how tokens are organized.";
    }

    const layers = ["primitive", "semantic", "component"].filter((layer) => list.base.get(layer) !== undefined);
    return layers.length === 0
        ? "No primitive, semantic, or component layers were found."
        : `Detected layers: ${layers.join(", ")}.`;
}

function applyArchitectureWarnings(cards: TokenCheckCard[], warnings: string[]): string[] {
    const groups = summarizeArchitectureWarnings(warnings);
    const rootCard = cards.find((card) => card.docsUrl.endsWith("#root-layer"));
    if (rootCard !== undefined && groups.length > 0) {
        if (rootCard.passed) {
            rootCard.name = LAYER_ALIAS_FAILED_NAME;
        }
        rootCard.passed = false;
        rootCard.severity = rootCard.severity === "error" ? "error" : "warning";
        const group = groups.length === 1 ? groups[0] : undefined;
        rootCard.description = group === undefined
            ? `Non-canonical layer names ${formatQuotedList(groups.map((item) => item.alias))} detected. Consider renaming them to ${formatQuotedList(unique(groups.map((item) => item.canonicalLayer)))} for consistency.`
            : `Non-canonical layer name “${group.alias}” detected. Consider renaming it to “${group.canonicalLayer}” for consistency.`;
        rootCard.issueHeading = group === undefined
            ? "Rename layer aliases to their canonical layer names."
            : `Rename the “${group.alias}” group to “${group.canonicalLayer}”.`;
        rootCard.issues = [...rootCard.issues, ...groups.map(formatArchitectureWarning)];
    }

    return unique(warnings.filter((warning) => ARCHITECTURE_ALIAS_PATTERN.exec(warning) === null));
}

function summarizeArchitectureWarnings(warnings: string[]): ArchitectureWarningGroup[] {
    const groups = new Map<string, ArchitectureWarningGroup>();

    for (const warning of warnings) {
        const match = ARCHITECTURE_ALIAS_PATTERN.exec(warning);
        if (match === null) continue;

        const path = match[1]!;
        const alias = match[2]!;
        const canonicalLayer = match[3]!;
        const key = `${alias}->${canonicalLayer}`;
        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, { path, alias, canonicalLayer, count: 1 });
        } else {
            group.count += 1;
        }
    }

    return Array.from(groups.values());
}

function formatArchitectureWarning(group: ArchitectureWarningGroup): string {
    return group.count === 1
        ? `"${group.path}" uses the alias "${group.alias}".`
        : `"${group.path}" and ${group.count - 1} more tokens use the alias "${group.alias}".`;
}

function summarizeIssues(issues: CheckIssue[]): string[] {
    const messages = unique(issues.map((issue) => issue.sourcePath === undefined
        ? issue.message
        : `${issue.sourcePath}: ${issue.message}`));
    const first = messages[0];
    if (first === undefined || messages.length === 1) {
        return messages;
    }

    return [`${first} and ${messages.length - 1} more issues.`];
}

function formatQuotedList(values: string[]): string {
    return values.map((value) => `“${value}”`).join(", ");
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}

interface ArchitectureWarningGroup {
    path: string;
    alias: string;
    canonicalLayer: string;
    count: number;
}
