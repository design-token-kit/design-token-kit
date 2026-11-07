import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeCheckScore } from "@design-token-kit/core/core/check/CheckScore";
import { loadUi, textOf, type LoadedUi } from "./loadUi";

function check(
    name: string,
    severity: "ok" | "warning" | "error",
    issues: string[] = [],
    issueDetails?: string[],
) {
    return {
        name,
        description: `${name} description`,
        docsUrl: "#",
        passed: severity === "ok",
        severity,
        issues,
        ...(issueDetails === undefined ? {} : { issueDetails }),
        notes: [],
    };
}

function readFailureCheck() {
    return { ...check("Token data could not be checked", "error", ["invalid token data"]), state: "read-failure" };
}

const ANALYTICS = {
    totalTokens: 145,
    referenceTokens: 44,
    rawValueTokens: 101,
    themeFiles: 2,
    primitiveTokens: 136,
    semanticTokens: 0,
    componentTokens: 9,
};

function analyzed(checks: unknown[], analytics = ANALYTICS) {
    const checkResults = checks as Array<{ passed: boolean; severity: string; state?: string }>;
    const scoredChecks = checkResults.filter((check) => check.state === undefined);
    const architectureScore = checkResults.some((check) => check.state === "not-checked")
        ? undefined
        : computeCheckScore(scoredChecks.map((check) => ({
            passed: check.passed,
            severity: check.severity === "error" ? "error" : "warning",
        })));
    return {
        type: "TOKENS_ANALYZED",
        payload: {
            summary: {},
            warnings: [],
            analytics: { ...analytics, architectureScore },
            architectureChecks: checks,
        },
    };
}

const EMPTY_ANALYTICS = {
    totalTokens: 0,
    referenceTokens: 0,
    rawValueTokens: 0,
    themeFiles: 0,
    primitiveTokens: 0,
    semanticTokens: 0,
    componentTokens: 0,
};

function emptyTokenState() {
    return {
        name: "No tokens found",
        description: "Add local Variables or Styles in Figma to run token checks.",
        docsUrl: "",
        passed: false,
        severity: "info",
        issues: [],
        notes: [],
        state: "empty",
    };
}

function notCheckedCheck() {
    return {
        name: "Architecture checks not run",
        description: "Layer and raw-value checks were skipped because token validation failed.",
        docsUrl: "",
        passed: false,
        severity: "info",
        issues: [],
        issueDetails: [],
        notes: [],
        state: "not-checked",
    };
}

const MIXED_CHECKS = [
    check("Non-standard layer names", "warning", ["\"components/button\" and 8 more tokens use the alias \"components\"."]),
    check("Invalid layer references", "error", ["component.a (component) references {primitive.b} (primitive) and 43 more issues."]),
    check("Raw values stay in primitive tokens", "ok"),
    check("No broken token references", "ok"),
    check("Missing token descriptions", "warning", ["primitive.a has no description and 141 more issues."]),
];

describe("Token tab", () => {
    let ui: LoadedUi;

    beforeEach(() => {
        ui = loadUi();
    });

    afterEach(() => {
        ui.close();
    });

    it("analyzes the tokens with the essential rules on load", () => {
        expect(ui.sent).toEqual([
            { type: "ANALYZE_TOKENS", linting: false },
            { type: "AUDIT_DESIGN", scope: "page" },
        ]);
        expect(textOf(ui.get("#analyze-tokens-label"))).toBe("Analyzing...");
        expect(ui.get("#token-tab-loading").hidden).toBe(false);
        expect(Array.from(ui.document.querySelectorAll<HTMLButtonElement>("[data-token-export-message]"))
            .every((button) => button.disabled)).toBe(true);
    });

    it("shows the counts and when the analysis ran", () => {
        ui.receive(analyzed(MIXED_CHECKS));

        expect(textOf(ui.get("#token-tab-count"))).toBe("3");
        expect(ui.get("#token-tab-loading").hidden).toBe(true);
        expect(textOf(ui.get("#token-stats"))).toBe("145 tokens · 44 references · 101 raw values · 2 themes");
        expect(ui.get("#analyzed-at").hidden).toBe(false);
        expect(textOf(ui.get("#analyzed-at"))).toMatch(/^analyzed /);
        expect(textOf(ui.get("#primitive-token-count"))).toBe("136");
        expect(textOf(ui.get("#analyze-tokens-label"))).toBe("Run again");
        expect(Array.from(ui.document.querySelectorAll<HTMLButtonElement>("[data-token-export-message]"))
            .every((button) => !button.disabled)).toBe(true);
    });

    it("shows an empty token state without checks, issue details, or a documentation link", () => {
        ui.receive(analyzed([emptyTokenState()], EMPTY_ANALYTICS));

        const card = ui.get("#token-summary > li");
        expect(card.className).toBe("finding finding--info");
        expect(textOf(card.querySelector(".finding__title")!)).toBe("No tokens found");
        expect(textOf(card.querySelector(".finding__description")!)).toBe("Add local Variables or Styles in Figma to run token checks.");
        expect(card.querySelector(".severity-icon")).not.toBeNull();
        expect(card.querySelector(".finding__count")).toBeNull();
        expect(card.querySelector(".examples")).toBeNull();
        expect(card.querySelector(".docs")).toBeNull();
        expect(card.querySelector(".chevron")).toBeNull();
        expect(ui.get("#passed-checks").hidden).toBe(true);
        expect(ui.get("#token-tab-count").hidden).toBe(true);
        expect(Array.from(ui.document.querySelectorAll<HTMLButtonElement>("[data-token-export-message]"))
            .every((button) => button.disabled)).toBe(true);
    });

    it("clears the loader after an initial analysis failure", () => {
        ui.receive({ type: "EXPORT_FAILED", payload: { message: "token export failed" } });

        expect(ui.get("#token-tab-loading").hidden).toBe(true);
        expect(ui.get("#token-tab-count").hidden).toBe(true);
        expect(textOf(ui.get("#analyze-tokens-label"))).toBe("Analyze tokens");
    });

    it("restores the previous issue badge after a failed rerun", () => {
        ui.receive(analyzed(MIXED_CHECKS));
        ui.click("#all-checks");

        expect(ui.get("#token-tab-loading").hidden).toBe(false);
        expect(ui.get("#token-tab-count").hidden).toBe(true);

        ui.receive({ type: "EXPORT_FAILED", payload: { message: "token export failed" } });

        expect(ui.get("#token-tab-loading").hidden).toBe(true);
        expect(ui.get("#token-tab-count").hidden).toBe(false);
        expect(textOf(ui.get("#token-tab-count"))).toBe("3");
        expect(textOf(ui.get("#analyze-tokens-label"))).toBe("Run again");
    });

    it("lists failing checks as findings with their issue counts", () => {
        ui.receive(analyzed(MIXED_CHECKS));

        const findings = Array.from(ui.document.querySelectorAll("#token-summary > li"));
        expect(findings.map((item) => textOf(item.querySelector(".finding__title")!))).toEqual([
            "Non-standard layer names",
            "Invalid layer references",
            "Missing token descriptions",
        ]);
        expect(findings.map((item) => item.className)).toEqual(["finding finding--warning", "finding finding--error", "finding finding--warning"]);
        expect(textOf(findings[1].querySelector(".finding__count")!)).toBe("44 issues");
    });

    it("keeps token check cards focused on guidance and examples", () => {
        ui.receive(analyzed(MIXED_CHECKS));

        const findings = Array.from(ui.document.querySelectorAll("#token-summary > li"));
        expect(findings.every((finding) => finding.querySelector(".finding__fix") === null)).toBe(true);
        expect(findings.map((finding) => textOf(finding.querySelector(".docs")!))).toEqual([
            "How to fix ↗",
            "How to fix ↗",
            "How to fix ↗",
        ]);
        expect(findings[0]!.querySelector<HTMLAnchorElement>(".docs")!.getAttribute("href")).toBe("#");
    });

    it("expands and collapses full issue diagnostics from the more button", () => {
        const details = ["first issue", "second issue", "third issue"];
        const expandableCheck = check("Expandable check", "warning", ["first issue and 2 more issues."], details);
        ui.receive(analyzed([expandableCheck]));

        const examplesGroup = ui.get(".examples__group");
        const examples = examplesGroup.querySelector<HTMLElement>(".examples")!;
        expect(examples.querySelectorAll(".example")).toHaveLength(1);
        expect(examples.querySelector(".examples__more")).toBeNull();
        expect(examplesGroup.querySelector(".examples__footer .docs")).not.toBeNull();
        expect(textOf(examplesGroup.querySelector(".examples__more")!)).toBe("and 2 more");
        expect(examplesGroup.querySelector(".examples__more")!.getAttribute("aria-expanded")).toBe("false");

        (examplesGroup.querySelector(".examples__more") as HTMLButtonElement).click();

        expect(examples.querySelectorAll(".example")).toHaveLength(3);
        expect(textOf(examplesGroup.querySelector(".examples__more")!)).toBe("Show fewer");
        expect(examplesGroup.querySelector(".examples__more")!.getAttribute("aria-expanded")).toBe("true");

        (examplesGroup.querySelector(".examples__more") as HTMLButtonElement).click();

        expect(examples.querySelectorAll(".example")).toHaveLength(1);
        expect(textOf(examplesGroup.querySelector(".examples__more")!)).toBe("and 2 more");
    });

    it("scores the share of passed checks with a grade coloured by the score", () => {
        ui.receive(analyzed(MIXED_CHECKS));
        expect(textOf(ui.get("#architecture-score"))).toBe("40");
        expect(textOf(ui.get("#architecture-grade"))).toBe("F");
        expect(ui.get("#architecture-grade").className).toBe("grade grade--poor");

        ui.receive(analyzed(MIXED_CHECKS.map((item) => item.severity === "error" ? check(item.name, "ok") : item)));
        expect(textOf(ui.get("#architecture-score"))).toBe("60");
        expect(textOf(ui.get("#architecture-grade"))).toBe("D");
        expect(ui.get("#architecture-grade").className).toBe("grade grade--poor");

        ui.receive(analyzed(MIXED_CHECKS.map((item, index) => index < 4 ? check(item.name, "ok") : item)));
        expect(textOf(ui.get("#architecture-score"))).toBe("80");
        expect(textOf(ui.get("#architecture-grade"))).toBe("B");
        expect(ui.get("#architecture-grade").className).toBe("grade");

        ui.receive(analyzed(MIXED_CHECKS.map((item) => check(item.name, "ok"))));
        expect(textOf(ui.get("#architecture-score"))).toBe("100");
        expect(textOf(ui.get("#architecture-grade"))).toBe("A");
        expect(ui.get("#architecture-grade").className).toBe("grade");
    });

    it("clears the architecture score when token data cannot be checked", () => {
        ui.receive(analyzed([check("Valid check", "ok")]));
        expect(textOf(ui.get("#architecture-score"))).toBe("100");

        ui.receive(analyzed([readFailureCheck()]));

        expect(textOf(ui.get("#architecture-score"))).toBe("N/A");
        expect(ui.document.querySelector("#architecture-verdict")).toBeNull();
        expect(ui.get("#passed-checks").hidden).toBe(false);
    });

    it("explains when architecture checks were skipped after validation errors", () => {
        ui.receive(analyzed([
            check("Token reference issues", "error", ["semantic.color.broken references a missing token"]),
            notCheckedCheck(),
        ]));

        expect(textOf(ui.get("#architecture-score"))).toBe("N/A");
        expect(textOf(ui.get("#architecture-formula"))).toContain("some architecture checks were not run");
        const findings = Array.from(ui.document.querySelectorAll("#token-summary > li"));
        expect(findings.map((item) => textOf(item.querySelector(".finding__title")!))).toEqual([
            "Token reference issues",
            "Architecture checks not run",
        ]);
        expect(findings[1]!.className).toBe("finding finding--info");
        expect(findings[1]!.querySelector(".finding__count")).toBeNull();
    });

    it("keeps architecture status in the expandable check summary", () => {
        ui.receive(analyzed(MIXED_CHECKS));
        expect(ui.document.querySelector("#architecture-verdict")).toBeNull();
        expect(textOf(ui.get("#passed-label"))).toBe("Passed 2 · Warnings 2 · Errors 1");

        ui.receive(analyzed(MIXED_CHECKS.map((item) => item.severity === "error" ? check(item.name, "ok") : item)));
        expect(ui.document.querySelector("#architecture-verdict")).toBeNull();
        expect(textOf(ui.get("#passed-label"))).toBe("Passed 3 · Warnings 2");

        ui.receive(analyzed(MIXED_CHECKS.map((item) => check(item.name, "ok"))));
        expect(ui.document.querySelector("#architecture-verdict")).toBeNull();
        expect(textOf(ui.get("#passed-label"))).toBe("Passed · 5");
    });

    it("explains the score on request", () => {
        ui.receive(analyzed(MIXED_CHECKS));

        expect(ui.get("#architecture-formula-toggle").textContent).toBe("?");
        expect(ui.get("#architecture-formula-toggle").getAttribute("aria-label")).toBe("How is this calculated?");
        expect(ui.get("#architecture-formula-toggle").getAttribute("title")).toBe("How is this calculated?");
        expect(ui.get("#architecture-formula").hidden).toBe(true);
        ui.click("#architecture-formula-toggle");
        expect(ui.get("#architecture-formula").hidden).toBe(false);
        expect(textOf(ui.get("#architecture-formula"))).toContain("Score = passed checks ÷ all checks × 100");
        expect(textOf(ui.get("#architecture-formula"))).toContain("2 of 5 checks passed: 40.");
    });

    it("lists every check under the score, failing ones first by severity", () => {
        ui.receive(analyzed(MIXED_CHECKS));

        expect(textOf(ui.get("#passed-label"))).toBe("Passed 2 · Warnings 2 · Errors 1");
        expect(ui.get("#passed-list").hidden).toBe(true);
        ui.click("#passed-toggle");
        expect(ui.get("#passed-list").hidden).toBe(false);
        const items = Array.from(ui.document.querySelectorAll("#passed-list li"));
        expect(items.map((item) => [textOf(item), item.className])).toEqual([
            ["Invalid layer references", "passed__item--error"],
            ["Non-standard layer names", "passed__item--warning"],
            ["Missing token descriptions", "passed__item--warning"],
            ["Raw values stay in primitive tokens", ""],
            ["No broken token references", ""],
        ]);
    });

    it("opens the list when every check passes", () => {
        ui.receive(analyzed(MIXED_CHECKS.map((item) => check(item.name, "ok"))));

        expect(textOf(ui.get("#passed-label"))).toBe("Passed · 5");
        expect(ui.get("#passed-list").hidden).toBe(false);
        expect(ui.get("#token-tab-count").hidden).toBe(true);
    });

    it("re-runs the analysis with every check when the rule set changes", () => {
        expect(ui.get<HTMLButtonElement>("#all-checks").disabled).toBe(true);
        ui.receive(analyzed(MIXED_CHECKS));

        ui.click("#all-checks");

        expect(ui.sent.at(-1)).toEqual({ type: "ANALYZE_TOKENS", linting: true });
        expect(ui.get("#all-checks").getAttribute("aria-pressed")).toBe("true");
        expect(textOf(ui.get("#rule-set-description"))).toBe("Review token layers, references, and raw values. Essentials covers core architecture rules; All checks adds detailed validation and linting.");
    });

    it("downloads a format straight from its tile", () => {
        ui.receive(analyzed([check("Raw values stay in primitive tokens", "ok")]));
        ui.click('[data-token-export-message="EXPORT_TOKENS_CSS"]');

        expect(ui.sent.at(-1)).toEqual({ type: "EXPORT_TOKENS_CSS" });
        expect(ui.get('[data-token-export-message="EXPORT_TOKENS_CSS"]').getAttribute("aria-pressed")).toBe("true");
        expect(ui.document.getElementById("export-detail")).toBeNull();
    });

});
