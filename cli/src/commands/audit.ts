import { Command, InvalidArgumentError, Option } from "commander";
import {
    TokenAuditor,
    WCAG_LEVELS,
    listAuditRules,
    type AuditReport,
    type AuditRuleInfo,
    type UncheckedSubject,
    type WcagLevel,
} from "@design-token-kit/core";
import { toDocumentFormat } from "#commands/formats";
import { hasErrors, printIssues } from "#commands/issues";

const EXIT_ISSUES = 2;
const EXIT_FAILURE = 1;

interface AuditOptions {
    level?: WcagLevel;
    rules?: string;
    minFontSize?: number;
    schema?: string;
    inform?: string;
}

export const auditCommand = new Command("audit")
    .description("Audit the design quality of token files: text contrast and readability.")
    .argument("[files...]", "Paths or content:<tokens> (stdin when omitted). The first file is the base set, the others are themes.")
    .addOption(
        new Option("--level <level>", "WCAG level text contrast is audited against")
            .choices(WCAG_LEVELS)
            .default("AA"),
    )
    .option("--rules <ids>", "Comma-separated allow-list of audit rules (default: all). See 'Available rules' below.")
    .option("--min-font-size <px>", "Smallest readable font size in px", parsePositiveNumber, 12)
    .option("--schema <path>", "DTCG JSON Schema: a directory path or a built-in schema name (default: 2025.10)")
    .option("-i, --inform [format]", "Input format: dtcg, hrdt, design-md (default: auto-detect)")
    .addHelpText("after", formatAvailableRules(listAuditRules()))
    .addHelpText("after", `
How text is paired with backgrounds:
  Colors named text-*, foreground-* or fg-* are paired with colors named
  background-*, bg-*, surface-* or canvas-* in the same group. An on-X color
  pairs with the color X only, and X with no other text color. Inverse colors
  pair with inverse colors only. Disabled colors and overlays are skipped. A
  pair is held to the large text minimum when its group holds a typography
  token of large text.

Score:
  100 - 2 x errors - 0.1 x warnings, rounded, never below 0.
  Grades: A 90+, B 80-89, C 70-79, D 60-69, F below 60.`)
    .addHelpText("after", "\nExit status:\n  0  no errors\n  1  unexpected error\n  2  errors found")
    .action(async (files: string[], options: AuditOptions) => {
        try {
            const sources = files.length > 0 ? files : ["-"];
            const auditor = new TokenAuditor({
                level: options.level,
                rules: splitList(options.rules),
                minFontSizePx: options.minFontSize,
                schema: options.schema,
                inform: options.inform !== undefined ? toDocumentFormat(options.inform) : undefined,
            });
            for (const id of auditor.unknownRules()) {
                console.warn(`warning: unknown audit rule '${id}'; skipped`);
            }

            const result = await auditor.audit(sources);
            printIssues(result.issues);
            if (!result.ok) {
                process.exit(EXIT_ISSUES);
            }

            printIssues(result.report.findings);
            printUnchecked(result.report.unchecked);
            console.log(formatSummary(result.report));
            if (hasErrors(result.report.findings)) {
                process.exit(EXIT_ISSUES);
            }
        }
        catch (error) {
            console.error("Audit failed:", (error as Error).message);
            process.exit(EXIT_FAILURE);
        }
    });

function printUnchecked(subjects: UncheckedSubject[]): void {
    for (const subject of subjects) {
        const source = subject.sourcePath === "-" ? "stdin" : subject.sourcePath;
        console.log(`[${subject.id}] not checked: ${source} - ${subject.message}`);
    }
}

function formatSummary(report: AuditReport): string {
    const errors = report.findings.filter((finding) => finding.severity === "error").length;
    const warnings = report.findings.length - errors;
    return `Audit: ${count(errors, "error")}, ${count(warnings, "warning")}, ${report.unchecked.length} not checked`
        + ` in ${count(report.sampleCount, "sample")}. ${formatScore(report.score)}`;
}

function formatScore(score: AuditReport["score"]): string {
    return score === undefined
        ? "Score unavailable: no sample could be checked."
        : `Score ${score.score} (${score.grade}).`;
}

function count(value: number, noun: string): string {
    return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function formatAvailableRules(rules: AuditRuleInfo[]): string {
    const idWidth = Math.max(...rules.map((rule) => rule.id.length));
    const lines = rules.map((rule) => `  ${rule.id.padEnd(idWidth)}  (${rule.category}, ${rule.severity})\n    ${rule.description}`);
    return `\nAvailable rules:\n${lines.join("\n")}`;
}

function parsePositiveNumber(value: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        throw new InvalidArgumentError("Expected a positive number.");
    }
    return number;
}

function splitList(value?: string): string[] | undefined {
    if (value === undefined) return undefined;
    const items = value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    return items.length > 0 ? items : undefined;
}
