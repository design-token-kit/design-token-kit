import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import type { TokenStats } from "#/core/stats/TokenStats";
import { TokenStatsCalculator, type TokenStat } from "#/core/stats/TokenStatsCalculator";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { TokenChecker } from "#/core/check/TokenChecker";

/**
 * Builds a text stats report from token sources.
 *
 * Loads and validates sources, computes stats and renders
 * the final CLI-friendly text output.
 */
export class TokenStatsBuilder implements TokenStats {
    readonly #loader: DtcgListLoader;
    readonly #checker: TokenChecker;
    readonly #calculator: TokenStatsCalculator;

    constructor(
        loader = new DtcgListLoader(),
        checker = new TokenChecker(),
        calculator = new TokenStatsCalculator(),
    ) {
        this.#loader = loader;
        this.#checker = checker;
        this.#calculator = calculator;
    }

    async stats(sources: string[]): Promise<string> {
        return this.#buildReport(await this.collect(sources));
    }

    async collect(sources: string[]): Promise<TokenStat[]> {
        if (sources.length === 0) {
            throw new Error("No token sources provided");
        }

        const issues = await this.#checker.check(sources);
        if (this.#hasErrors(issues)) {
            throw new Error(this.#formatIssues(issues));
        }

        // The product here is the model, so a source that cannot be read is an
        // exception rather than a value: `load` raises one that already names
        // every diagnostic it collected.
        return this.#calculator.calculate(await this.#loader.load(sources));
    }

    #buildReport(stats: readonly TokenStat[]): string {
        const lines: string[] = ["Token Overview", ""];
        const summaryWidth = Math.max(...stats.map((stat) => stat.label.length));

        for (const stat of stats) {
            lines.push(`${stat.label}:${" ".repeat(summaryWidth - stat.label.length + 1)}${this.#formatSummaryValue(stat)}`);
        }

        const breakdowns = stats.flatMap((stat) => stat.breakdowns ?? []);
        if (breakdowns.length > 0) {
            lines.push("");
        }

        for (const stat of stats) {
            for (const breakdown of stat.breakdowns ?? []) {
                if (breakdown.items.length === 0) {
                    continue;
                }

                lines.push(`${breakdown.label}:`);
                const itemWidth = Math.max(...breakdown.items.map((item) => item.label.length));
                for (const item of breakdown.items) {
                    const value = this.#formatBreakdownValue(item);
                    if (value === undefined) {
                        lines.push(`  ${item.label}`);
                        continue;
                    }

                    lines.push(`  ${item.label} ${".".repeat(itemWidth - item.label.length + 4)} ${value}`);
                }
                lines.push("");
            }
        }

        while (lines.at(-1) === "") {
            lines.pop();
        }

        return `${lines.join("\n")}\n`;
    }

    #hasErrors(issues: CheckIssue[]): boolean {
        return issues.some((issue) => issue.severity === "error");
    }

    #formatIssues(issues: CheckIssue[]): string {
        return issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => `[${issue.id}] ${issue.sourcePath} - ${issue.message}`)
            .join("\n");
    }

    #formatBreakdownValue(item: { value?: number; percentage?: number }): string | undefined {
        if (item.value === undefined) {
            return undefined;
        }

        if (item.percentage === undefined) {
            return String(item.value);
        }

        return `${item.value} - ${item.percentage.toFixed(1)}%`;
    }

    #formatSummaryValue(stat: { value: number; percentage?: number }): string {
        if (stat.percentage === undefined) {
            return String(stat.value);
        }

        return `${stat.value} - ${stat.percentage.toFixed(1)}%`;
    }
}
