import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadUi, textOf, type LoadedUi } from "./loadUi";

interface ReportOptions {
    errors?: number;
    warnings?: number;
    notChecked?: number;
    contrastErrors?: number;
    score?: number;
    grade?: string;
    passed?: number;
    failed?: number;
    manualReview?: number;
    nodeCount?: number;
    layerCount?: number;
    coverage?: { total: number; bound: number; percent?: number };
    tokenUsage?: { score: number; grade: string; clean: number; total: number } | null;
    accessibilityUnavailable?: boolean;
    scope?: "page" | "file";
    groups?: unknown[];
}

function nodes(prefix: string, count: number, meta: (index: number) => string) {
    return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}:${index}`,
        name: `${prefix} ${index}`,
        path: index === 0 ? "" : "Card / Product",
        meta: meta(index),
    }));
}

const CONTRAST_GROUP = {
    id: "text-contrast-aa",
    severity: "error",
    category: "accessibility",
    title: "Low text contrast (WCAG AA)",
    description: "Body text needs 4.5:1 and large text 3:1. The lowest ratio found is 2.1:1.",
    docsUrl: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    nodes: nodes("Caption", 7, (index) => `${2 + index / 10}:1`),
};
const UNCHECKED_GROUP = {
    id: "text-contrast-unchecked",
    severity: "not-checked",
    category: "accessibility",
    title: "Contrast needs manual review",
    description: "Some text uses images, gradients, mixed fills, transparency, or symbols with an uncertain role, so contrast needs manual review.",
    docsUrl: "https://design-token-kit.github.io/docs/guides/figma-plugin/#design-audit-manual-review",
    nodes: nodes("Hero", 3, () => "gradient"),
};
const NON_TEXT_GROUP = {
    id: "non-text-contrast-unchecked",
    severity: "not-checked",
    category: "accessibility",
    title: "Non-text contrast needs manual review",
    description: "Some graphical elements need manual review to determine their purpose or contrast.",
    docsUrl: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html",
    nodes: [{
        id: "Arrow:0",
        name: "Arrow 0",
        path: "Card / Product",
        meta: "3.58:1",
        note: "Role unclear",
        detail: "the graphical symbol role is uncertain",
    }],
};

const USAGE_GROUP = {
    id: "hardcoded-color",
    severity: "warning",
    category: "token-usage",
    title: "Hard-coded colors",
    description: "Some fills and strokes use fixed colors instead of Variables or Styles.",
    stats: "2 of 3 properties have a matching Variable or Style",
    docsUrl: "#",
    nodes: [
        { id: "card", name: "Card", path: "Page", meta: "Fill #2563eb", note: "Exact match: semantic/accent" },
        { id: "card", name: "Card", path: "Page", meta: "Stroke #e5e7eb", note: "Closest match: semantic/border" },
        { id: "button", name: "Button", path: "Card", meta: "Padding top 13px", note: "No match found" },
    ],
};

const SPACING_GROUP = {
    id: "hardcoded-spacing",
    severity: "warning",
    category: "token-usage",
    title: "Hard-coded spacing and radii",
    description: "Some gaps, padding, and corner radii use fixed values instead of Variables.",
    stats: "2 of 3 properties have a matching Variable",
    docsUrl: "#hardcoded-value",
    nodes: [
        { id: "stack", name: "Stack", path: "Page", meta: "Padding top 16px", note: "Exact match: spacing/4" },
        { id: "card", name: "Card", path: "Page", meta: "Radius 9px", note: "Closest match: spacing/4" },
        { id: "grid", name: "Grid", path: "Page", meta: "Gap 30px", note: "No match found" },
    ],
};

const FONT_SIZE_GROUP = {
    id: "hardcoded-font-size",
    severity: "warning",
    category: "token-usage",
    title: "Unbound font sizes",
    description: "Some text uses fixed font sizes instead of Text Styles or Variables.",
    stats: "2 of 3 properties have a matching Text Style or Variable",
    docsUrl: "#hardcoded-value",
    nodes: [
        { id: "heading", name: "Heading", path: "Page", meta: "Font size 16px", note: "Exact font-size match: Typography/Heading" },
        { id: "body", name: "Body", path: "Page", meta: "Font size 15px", note: "Closest font-size match: typography/body-size" },
        { id: "display", name: "Display", path: "Page", meta: "Font size 30px", note: "No font-size match found" },
    ],
};

const PRIMITIVE_BINDING_GROUP = {
    id: "primitive-binding",
    severity: "warning",
    category: "token-usage",
    title: "Direct primitive bindings",
    description: "Some layer properties use Primitive Variables directly instead of role-based tokens.",
    stats: "2 of 3 properties have a possible higher-level match",
    docsUrl: "#primitive-binding",
    nodes: [
        { id: "exact", name: "Exact", path: "Page", meta: "Fill #2563eb", note: "Bound to: primitive/blue/500 · Exact value match: semantic/accent" },
        { id: "close", name: "Close", path: "Page", meta: "Gap 15px", note: "Bound to: primitive/spacing/4 · Closest value match: semantic/spacing/4" },
        { id: "missing", name: "Missing", path: "Page", meta: "Stroke #ff0000", note: "Bound to: primitive/red/500 · No higher-level match found" },
    ],
};

function report(options: ReportOptions = {}) {
    return {
        type: "DESIGN_AUDITED",
        payload: {
            scope: options.scope ?? "page",
            level: "AA",
            nodeCount: options.nodeCount ?? 40,
            layerCount: options.layerCount ?? 25,
            coverage: options.coverage ?? { total: 80, bound: 52, percent: 65, byProperty: {} },
            scores: {
                accessibility: options.accessibilityUnavailable || (options.nodeCount ?? 40) === 0
                    ? undefined
                    : {
                        score: options.score ?? 85,
                        grade: options.grade ?? "B",
                        evaluated: (options.passed ?? 17) + (options.failed ?? 3),
                        passed: options.passed ?? 17,
                        failed: options.failed ?? 3,
                        manualReview: options.manualReview ?? options.notChecked ?? 3,
                        skipped: 0,
                    },
                tokenUsage: options.tokenUsage === null ? undefined : options.tokenUsage ?? { score: 60, grade: "D", clean: 48, total: 80 },
            },
            counts: { errors: options.errors ?? 7, warnings: options.warnings ?? 2, notChecked: options.notChecked ?? 3 },
            contrastErrors: options.contrastErrors ?? 7,
            groups: options.groups ?? [CONTRAST_GROUP, UNCHECKED_GROUP],
        },
    };
}

describe("Design tab", () => {
    let ui: LoadedUi;

    beforeEach(() => {
        ui = loadUi();
    });

    afterEach(() => {
        ui.close();
    });

    function auditMessages() {
        return ui.sent.filter((message) => message.type === "AUDIT_DESIGN");
    }

    function footerTexts(group: Element): string[] {
        return Array.from(group.querySelector(".group__footer")!.children, textOf);
    }

    function openWithReport(options: ReportOptions = {}) {
        ui.click("#design-tab");
        ui.receive(report(options));
    }

    it("audits the current page the first time the tab opens", () => {
        ui.click("#design-tab");

        expect(ui.get("#audited-at").hidden).toBe(true);
        expect(ui.get("#audit-meta").hidden).toBe(true);

        expect(auditMessages()).toEqual([{ type: "AUDIT_DESIGN", scope: "page" }]);
        expect(ui.get<HTMLButtonElement>("#run-audit").disabled).toBe(true);
        expect(ui.get("#design-tab-loading").hidden).toBe(false);
        expect(textOf(ui.get("#run-audit-label"))).toBe("Auditing...");
        expect(textOf(ui.get("#audit-status"))).toBe("Auditing the text on this page...");

        ui.click("#token-tab");
        ui.click("#design-tab");
        expect(auditMessages()).toHaveLength(1);
    });

    it("shows the scores, the counts and the formulas", () => {
        openWithReport();

        expect(ui.get("#audit-results").hidden).toBe(false);
        expect(ui.get("#audit-status").hidden).toBe(true);
        expect(ui.get("#design-workspace > .design-audit-shell > #audit-results")).not.toBeNull();
        expect(textOf(ui.get("#design-workspace .lead"))).toBe("Use this audit to find accessibility issues, check text contrast, and spot inconsistent token usage in the selected layers before handoff.");
        expect(textOf(ui.get("#accessibility-score"))).toBe("85%");
        expect(textOf(ui.get("#accessibility-title"))).toBe("Accessibility checks");
        expect(textOf(ui.get("#accessibility-level")).trim()).toBe("AA");
        expect(ui.get("#accessibility-formula-toggle").textContent).toBe("?");
        expect(ui.get("#accessibility-formula-toggle").getAttribute("aria-label")).toBe("How is the score calculated?");
        expect(ui.get("#usage-formula-toggle").textContent).toBe("?");
        expect(ui.get("#usage-formula-toggle").getAttribute("aria-label")).toBe("How is the score calculated?");
        expect(textOf(ui.get(".audit-category__title p"))).toContain("We check text contrast automatically");
        expect(textOf(ui.get(".audit-category__title p"))).toContain("Please review icons and other visual elements manually");
        expect(ui.get(".audit-category__title p br")).not.toBeNull();
        expect(ui.get<HTMLAnchorElement>("#accessibility-standard-link").href).toBe("https://www.w3.org/TR/WCAG22/");
        expect(ui.get<HTMLAnchorElement>("#accessibility-standard-link").target).toBe("_blank");
        expect(textOf(ui.get("#accessibility-grade"))).toBe("B");
        expect(ui.get("#accessibility-grade").className).toBe("grade");
        expect(textOf(ui.get("#accessibility-checks-label"))).toBe("Passed 17 · Failed 3");
        expect(ui.get("#accessibility-checks-list").hidden).toBe(true);
        expect(ui.document.querySelector("#accessibility-summary")).toBeNull();
        expect(textOf(ui.get("#audit-meta"))).toBe("40 text layers · 25 layers checked for variables");
        expect(Array.from(ui.get("#audit-meta").querySelectorAll("strong"), textOf)).toEqual(["40", "25"]);
        expect(ui.window.getComputedStyle(ui.get("#token-workspace .arch-head__actions")).width).toBe("200px");
        expect(ui.window.getComputedStyle(ui.get("#design-workspace .arch-head__actions")).width).toBe("200px");
        expect(textOf(ui.get("#usage-score"))).toBe("60");
        expect(textOf(ui.get("#usage-grade"))).toBe("D");
        expect(ui.get("#usage-grade").className).toBe("grade grade--poor");
        expect(ui.get("#accessibility-audit").hidden).toBe(false);
        expect(ui.get("#token-usage-audit").hidden).toBe(false);
        expect(ui.get("#audited-at").hidden).toBe(false);
        expect(textOf(ui.get("#audited-at"))).toMatch(/^audited /);
        expect(textOf(ui.get("#run-audit-label"))).toBe("Run again");

        expect(ui.get("#accessibility-formula").hidden).toBe(true);
        expect(ui.get("#usage-formula").hidden).toBe(true);
        ui.click("#accessibility-formula-toggle");
        ui.click("#usage-formula-toggle");
        expect(ui.get("#accessibility-formula").hidden).toBe(false);
        expect(ui.get("#usage-formula").hidden).toBe(false);
        expect(textOf(ui.get("#accessibility-formula"))).toContain("17 ÷ (17 + 3) × 100 = 85%.");
        expect(textOf(ui.get("#usage-formula"))).toContain("48 of 80 properties are bound to a variable or style and not to a primitive: 60, rounded down. Not part of WCAG.");

        ui.click("#accessibility-checks-toggle");
        expect(ui.get("#accessibility-checks-list").hidden).toBe(false);
        expect(Array.from(ui.document.querySelectorAll("#accessibility-checks-list li"), textOf)).toEqual([
            "Passed text contrast checks: 17",
            "Failed text contrast checks: 3",
            "Manual review items: 3",
        ]);
    });

    it("shows the number of errors on the tab", () => {
        openWithReport();
        expect(ui.get("#design-tab-count").hidden).toBe(false);
        expect(textOf(ui.get("#design-tab-count"))).toBe("7");

        ui.receive(report({ errors: 0, contrastErrors: 0 }));
        expect(ui.get("#design-tab-count").hidden).toBe(true);
    });

    it.each([
        ["A", "grade"],
        ["C", "grade grade--fair"],
        ["D", "grade grade--poor"],
        ["F", "grade grade--poor"],
    ])("colours grade %s", (grade, className) => {
        openWithReport({ grade });
        expect(ui.get("#accessibility-grade").className).toBe(className);
    });

    it("confirms when no text fails the contrast minimum", () => {
        openWithReport({ errors: 0, contrastErrors: 0, passed: 20, failed: 0, manualReview: 0, notChecked: 0, groups: [] });

        expect(textOf(ui.get("#accessibility-checks-label"))).toBe("Passed 20 · Failed 0");
    });

    it("does not show a score when every text layer needs a manual contrast check", () => {
        openWithReport({
            nodeCount: 3,
            layerCount: 0,
            errors: 0,
            warnings: 0,
            notChecked: 3,
            contrastErrors: 0,
            tokenUsage: null,
            accessibilityUnavailable: true,
            groups: [UNCHECKED_GROUP],
        });

        expect(textOf(ui.get("#accessibility-score"))).toBe("N/A");
        expect(textOf(ui.get("#accessibility-checks-label"))).toBe("Passed 0 · Failed 0");

        ui.click("#accessibility-checks-toggle");
        expect(Array.from(ui.document.querySelectorAll("#accessibility-checks-list li"), textOf)).toEqual([
            "Manual review items: 3",
        ]);
    });

    it("lists the issues, with what could not be checked in a section of its own", () => {
        openWithReport();

        const titles = Array.from(ui.document.querySelectorAll("#accessibility-groups .group__title, #accessibility-groups h3"), textOf);
        expect(titles).toEqual([
            "Low text contrast (WCAG AA)",
            "Manual review",
            "Contrast needs manual review",
        ]);
        expect(textOf(ui.get("#accessibility-groups .group__count"))).toBe("7 layers");
    });

    it("renders and selects non-text contrast manual-review findings", () => {
        openWithReport({ groups: [NON_TEXT_GROUP] });

        const group = ui.get("#accessibility-groups .group");
        expect(textOf(group.querySelector(".group__title")!)).toBe("Non-text contrast needs manual review");
        group.querySelector<HTMLButtonElement>(".group__head")!.click();
        expect(textOf(group.querySelector(".group__description")!)).toBe(NON_TEXT_GROUP.description);
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")?.href).toContain("non-text-contrast.html");

        group.querySelector<HTMLButtonElement>(".node-row .pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["Arrow:0"] });
        expect(group.querySelector(".group__footer .pick")).toBeNull();
    });

    it("shortens non-text diagnostics while preserving long layer details and controls", () => {
        const longName = "Arrow icon with a deliberately long Figma layer name that must remain selectable";
        const longPath = "Toolbar / Navigation / Actions / Overflow menu / More controls";
        const diagnostic = "the layer contains a private-use glyph, and Figma does not expose whether it is an icon or readable text";
        const group = {
            ...NON_TEXT_GROUP,
            nodes: [{
                id: "arrow:long",
                name: longName,
                path: longPath,
                meta: "3.58:1",
                note: "Role unclear",
                detail: diagnostic,
            }],
        };
        openWithReport({ groups: [group] });

        const row = ui.get("#accessibility-groups .node-row");
        const name = row.querySelector<HTMLElement>(".node-row__name")!;
        const path = row.querySelector<HTMLElement>(".node-row__path")!;
        const meta = row.querySelector<HTMLElement>(".node-row__meta")!;

        expect(textOf(name)).toBe(longName);
        expect(name.title).toBe(longName);
        expect(textOf(path)).toBe(longPath);
        expect(path.title).toBe(longPath);
        expect(textOf(meta)).toBe("3.58:1");
        const note = row.querySelector<HTMLElement>(".node-row__note")!;
        expect(textOf(note)).toBe("Role unclear");
        expect(note.title).toBe(diagnostic);
        expect(note.getAttribute("aria-label")).toBe(`Role unclear: ${diagnostic}`);
        expect(row.querySelector<HTMLButtonElement>(".pick")!.textContent).toBe("Select");
        expect(textOf(row.closest(".group")!.querySelector(".group__footer .docs")!)).toBe("How to fix ↗");

        row.querySelector<HTMLButtonElement>(".pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["arrow:long"] });
    });

    it("shows findings only in their category block", () => {
        openWithReport({ groups: [CONTRAST_GROUP, USAGE_GROUP] });

        expect(Array.from(ui.document.querySelectorAll("#accessibility-groups .group__title"), textOf))
            .toEqual(["Low text contrast (WCAG AA)"]);
        expect(Array.from(ui.document.querySelectorAll("#usage-groups .group__title"), textOf))
            .toEqual(["Hard-coded colors"]);
    });

    it("opens an accessibility group without an inline Fix section", () => {
        openWithReport();
        const group = ui.get("#accessibility-groups .group");
        const head = group.querySelector<HTMLButtonElement>(".group__head")!;
        const body = head.nextElementSibling as HTMLElement;

        expect(body.hidden).toBe(true);
        head.click();
        expect(body.hidden).toBe(false);
        expect(head.getAttribute("aria-expanded")).toBe("true");
        expect(group.classList.contains("is-open")).toBe(true);
        expect(group.querySelector(".group__fix")).toBeNull();
        expect(group.querySelector(".group__body > .docs")).toBeNull();
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")?.href).toContain("contrast-minimum.html");
        expect(group.querySelector(".group__footer .pick")).toBeNull();

        const rows = Array.from(group.querySelectorAll<HTMLElement>(".node-row"));
        expect(rows.filter((row) => !row.hidden)).toHaveLength(5);
        expect(footerTexts(group)).toEqual(["and 2 more", "How to fix ↗"]);

        group.querySelector<HTMLButtonElement>(".group__footer .text-btn")!.click();
        expect(rows.every((row) => !row.hidden)).toBe(true);
        expect(footerTexts(group)).toEqual(["Show fewer", "How to fix ↗"]);

        head.click();
        expect(body.hidden).toBe(true);
    });

    it("keeps long finding details separated from the expandable header", () => {
        const description = "This longer description wraps naturally and keeps the documentation link aligned with it without touching the card border.";
        openWithReport({ groups: [{ ...CONTRAST_GROUP, description }] });

        const group = ui.get("#accessibility-groups .group");
        const head = group.querySelector<HTMLButtonElement>(".group__head")!;
        head.click();
        const body = group.querySelector<HTMLElement>(".group__body")!;

        expect(textOf(body.querySelector(".group__description")!)).toBe(description);
        const docs = group.querySelector<HTMLAnchorElement>(".group__footer .docs")!;
        expect(docs).not.toBeNull();
        expect(ui.window.getComputedStyle(body).display).toBe("grid");
        expect(ui.window.getComputedStyle(docs).marginLeft).toBe("auto");
        expect(ui.window.getComputedStyle(body).paddingTop).toBe("8px");
        expect(body.style.height).toBe("");
    });

    it("shows each layer with its path and measurement", () => {
        openWithReport();
        const [first, second] = Array.from(ui.document.querySelectorAll<HTMLElement>("#accessibility-groups .node-row"));

        expect(textOf(first.querySelector(".node-row__name")!)).toBe("Caption 0");
        expect(textOf(first.querySelector(".node-row__path")!)).toBe("Page");
        expect(textOf(first.querySelector(".node-row__meta")!)).toBe("2:1");
        expect(textOf(second.querySelector(".node-row__path")!)).toBe("Card / Product");
        expect(second.querySelector(".pick")!.getAttribute("aria-label")).toBe("Select Caption 1 in Card / Product");
    });

    it("selects one layer from an accessibility group in Figma", () => {
        openWithReport();
        const rows = Array.from(ui.document.querySelectorAll<HTMLElement>("#accessibility-groups .group:first-of-type .node-row"));

        rows[1].querySelector<HTMLButtonElement>(".pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["Caption:1"] });
        expect(rows.map((row) => row.classList.contains("is-selected"))).toEqual([false, true, false, false, false, false, false]);
        expect(rows[1].querySelector(".pick")!.getAttribute("aria-pressed")).toBe("true");

        expect(rows.every((row, index) => row.classList.contains("is-selected") === (index === 1))).toBe(true);
        expect(ui.document.querySelector("#accessibility-groups .group__footer .pick")).toBeNull();
    });

    it("shows layer names as text, never as markup", () => {
        const group = { ...CONTRAST_GROUP, nodes: [{ id: "1:1", name: "<img src=x onerror=alert(1)>", path: "<b>Card</b>", meta: "10px" }] };
        openWithReport({ groups: [group] });

        expect(ui.document.querySelector("#accessibility-groups img")).toBeNull();
        expect(textOf(ui.get("#accessibility-groups .node-row__name"))).toBe("<img src=x onerror=alert(1)>");
        expect(textOf(ui.get("#accessibility-groups .node-row__path"))).toBe("<b>Card</b>");
    });

    it("audits the whole file when the scope changes", () => {
        openWithReport();

        ui.click('[data-audit-scope="file"]');

        expect(auditMessages().at(-1)).toEqual({ type: "AUDIT_DESIGN", scope: "file" });
        expect(ui.get('[data-audit-scope="file"]').getAttribute("aria-pressed")).toBe("true");
        expect(ui.get('[data-audit-scope="page"]').getAttribute("aria-pressed")).toBe("false");
    });

    it("re-runs the audit on request", () => {
        openWithReport();

        ui.click("#run-audit");

        expect(auditMessages()).toHaveLength(2);
        expect(textOf(ui.get("#run-audit-label"))).toBe("Auditing...");
    });

    it("explains an empty page", () => {
        openWithReport({ nodeCount: 0, layerCount: 0, groups: [] });

        expect(ui.get("#audit-results").hidden).toBe(false);
        expect(textOf(ui.get("#accessibility-score"))).toBe("N/A");
        expect(textOf(ui.get("#audit-status"))).toBe("There are no visible layers in this page to audit.");
    });

    it("shows the results of a page with layers but no text", () => {
        openWithReport({ nodeCount: 0, errors: 0, contrastErrors: 0, groups: [USAGE_GROUP] });

        expect(ui.get("#audit-results").hidden).toBe(false);
        expect(ui.get("#accessibility-audit").hidden).toBe(true);
        expect(ui.get("#token-usage-audit").hidden).toBe(false);
    });

    it("shows only the accessibility block when no property was audited", () => {
        openWithReport({ coverage: { total: 0, bound: 0 }, tokenUsage: null });

        expect(ui.get("#token-usage-audit").hidden).toBe(true);
        expect(ui.get("#accessibility-audit").hidden).toBe(false);
        ui.click("#accessibility-formula-toggle");
        expect(textOf(ui.get("#accessibility-formula"))).not.toContain("Token usage");
    });

    it("shows only the token usage block when there is no text", () => {
        openWithReport({ nodeCount: 0, errors: 0, contrastErrors: 0, groups: [USAGE_GROUP] });

        expect(ui.get("#accessibility-audit").hidden).toBe(true);
        expect(ui.get("#token-usage-audit").hidden).toBe(false);
        ui.click("#usage-formula-toggle");
        expect(textOf(ui.get("#usage-formula"))).not.toContain("Accessibility");
    });

    it("summarizes and expands all token usage checks", () => {
        openWithReport({ groups: [USAGE_GROUP] });

        expect(textOf(ui.get("#usage-checks-label"))).toBe("Passed 3 · Warnings 1");
        expect(ui.get("#usage-checks-list").hidden).toBe(true);

        ui.click("#usage-checks-toggle");

        expect(ui.get("#usage-checks-list").hidden).toBe(false);
        expect(Array.from(ui.document.querySelectorAll("#usage-checks-list li"), textOf)).toEqual([
            "Hard-coded colors",
            "Hard-coded spacing and radii",
            "Unbound font sizes",
            "Direct primitive bindings",
        ]);
        expect(ui.get("#usage-checks-toggle").getAttribute("aria-expanded")).toBe("true");
    });

    it("marks all token usage checks as passed when there are no findings", () => {
        openWithReport({ groups: [] });

        expect(textOf(ui.get("#usage-checks-label"))).toBe("Passed · 4");
        ui.click("#usage-checks-toggle");
        expect(Array.from(ui.document.querySelectorAll("#usage-checks-list li"), textOf)).toEqual([
            "Hard-coded colors",
            "Hard-coded spacing and radii",
            "Unbound font sizes",
            "Direct primitive bindings",
        ]);
    });

    it("lists token usage findings by property, with the variable to use", () => {
        openWithReport({ groups: [USAGE_GROUP] });
        const group = ui.get("#usage-groups .group");

        expect(textOf(group.querySelector(".group__count")!)).toBe("3 properties");
        expect(textOf(group.querySelector(".group__description")!)).toBe("Some fills and strokes use fixed colors instead of Variables or Styles.");
        expect(textOf(group.querySelector(".group__stats")!)).toBe("2 of 3 properties have a matching Variable or Style");
        expect(group.querySelector(".group__fix")).toBeNull();
        expect(group.querySelector(".group__body > .docs")).toBeNull();
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")!.getAttribute("href")).toBe("#");
        expect(group.querySelector(".group__footer .pick")).toBeNull();
        expect(Array.from(group.querySelectorAll(".node-row__meta"), textOf)).toEqual(["Fill #2563eb", "Stroke #e5e7eb", "Padding top 13px"]);
        expect(Array.from(group.querySelectorAll(".node-row__note"), textOf)).toEqual(["Exact match: semantic/accent", "Closest match: semantic/border", "No match found"]);
        expect(footerTexts(group)).toContain("How to fix ↗");
    });

    it("renders hard-coded spacing and radii with compact matching statistics", () => {
        openWithReport({ groups: [SPACING_GROUP] });
        const group = ui.get("#usage-groups .group");

        expect(textOf(group.querySelector(".group__title")!)).toBe("Hard-coded spacing and radii");
        expect(textOf(group.querySelector(".group__description")!)).toBe("Some gaps, padding, and corner radii use fixed values instead of Variables.");
        expect(textOf(group.querySelector(".group__stats")!)).toBe("2 of 3 properties have a matching Variable");
        expect(group.querySelector(".group__fix")).toBeNull();
        expect(group.querySelector(".group__body > .docs")).toBeNull();
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")!.getAttribute("href")).toBe("#hardcoded-value");
        expect(group.querySelector(".group__footer .pick")).toBeNull();
        expect(Array.from(group.querySelectorAll(".node-row__meta"), textOf)).toEqual(["Padding top 16px", "Radius 9px", "Gap 30px"]);
        expect(Array.from(group.querySelectorAll(".node-row__note"), textOf)).toEqual([
            "Exact match: spacing/4",
            "Closest match: spacing/4",
            "No match found",
        ]);
        expect(footerTexts(group)).toContain("How to fix ↗");

        group.querySelector<HTMLButtonElement>(".node-row .pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["stack"] });
    });

    it("renders unbound font sizes without implying a complete text-style match", () => {
        openWithReport({ groups: [FONT_SIZE_GROUP] });
        const group = ui.get("#usage-groups .group");

        expect(textOf(group.querySelector(".group__title")!)).toBe("Unbound font sizes");
        expect(textOf(group.querySelector(".group__description")!)).toBe("Some text uses fixed font sizes instead of Text Styles or Variables.");
        expect(textOf(group.querySelector(".group__stats")!)).toBe("2 of 3 properties have a matching Text Style or Variable");
        expect(group.querySelector(".group__fix")).toBeNull();
        expect(group.querySelector(".group__body > .docs")).toBeNull();
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")!.getAttribute("href")).toBe("#hardcoded-value");
        expect(group.querySelector(".group__footer .pick")).toBeNull();
        expect(Array.from(group.querySelectorAll(".node-row__meta"), textOf)).toEqual([
            "Font size 16px",
            "Font size 15px",
            "Font size 30px",
        ]);
        expect(Array.from(group.querySelectorAll(".node-row__note"), textOf)).toEqual([
            "Exact font-size match: Typography/Heading",
            "Closest font-size match: typography/body-size",
            "No font-size match found",
        ]);
        expect(footerTexts(group)).toContain("How to fix ↗");

        group.querySelector<HTMLButtonElement>(".node-row .pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["heading"] });
    });

    it("renders direct primitive bindings with value-match details and both selection controls", () => {
        openWithReport({ groups: [PRIMITIVE_BINDING_GROUP] });
        const group = ui.get("#usage-groups .group");

        expect(textOf(group.querySelector(".group__title")!)).toBe("Direct primitive bindings");
        expect(textOf(group.querySelector(".group__description")!)).toBe("Some layer properties use Primitive Variables directly instead of role-based tokens.");
        expect(textOf(group.querySelector(".group__stats")!)).toBe("2 of 3 properties have a possible higher-level match");
        expect(group.querySelector(".group__fix")).toBeNull();
        expect(group.querySelector(".group__body > .docs")).toBeNull();
        expect(group.querySelector<HTMLAnchorElement>(".group__footer .docs")!.getAttribute("href")).toBe("#primitive-binding");
        expect(Array.from(group.querySelectorAll(".node-row__meta"), textOf)).toEqual([
            "Fill #2563eb",
            "Gap 15px",
            "Stroke #ff0000",
        ]);
        expect(Array.from(group.querySelectorAll(".node-row__note"), textOf)).toEqual([
            "Bound to: primitive/blue/500 · Exact value match: semantic/accent",
            "Bound to: primitive/spacing/4 · Closest value match: semantic/spacing/4",
            "Bound to: primitive/red/500 · No higher-level match found",
        ]);
        expect(footerTexts(group)).toEqual(["All 3 shown", "Select all 3", "How to fix ↗"]);

        group.querySelector<HTMLButtonElement>(".node-row .pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["exact"] });
        group.querySelector<HTMLButtonElement>(".group__footer .pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["exact", "close", "missing"] });
    });

    it("truncates long token suggestions without hiding layer selection", () => {
        const longTokenName = "semantic/component/navigation/interactive-border-strong-hover";
        const group = {
            ...USAGE_GROUP,
            nodes: [{
                id: "long-layer",
                name: "Navigation control with a long layer name",
                path: "Page / Header / Navigation / Actions",
                meta: "Stroke #e5e7eb",
                note: `Closest match: ${longTokenName}`,
            }],
        };
        openWithReport({ groups: [group] });

        const row = ui.get("#usage-groups .node-row");
        const note = row.querySelector<HTMLElement>(".node-row__note")!;
        expect(textOf(note)).toBe(`Closest match: ${longTokenName}`);
        expect(note.title).toBe(`Closest match: ${longTokenName}`);
        expect(row.querySelector<HTMLButtonElement>(".pick")!.textContent).toBe("Select");

        row.querySelector<HTMLButtonElement>(".pick")!.click();
        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["long-layer"] });
    });

    it("keeps individual hard-coded color selection with the footer documentation link", () => {
        openWithReport({ groups: [USAGE_GROUP] });

        const group = ui.get("#usage-groups .group");
        const select = group.querySelector<HTMLButtonElement>(".node-row .pick")!;
        select.click();

        expect(ui.sent.at(-1)).toEqual({ type: "SELECT_NODES", ids: ["card"] });
        expect(group.querySelector<HTMLElement>(".node-row")!.classList.contains("is-selected")).toBe(true);
        expect(select.getAttribute("aria-pressed")).toBe("true");
        expect(group.querySelector(".group__footer .pick")).toBeNull();
    });

    it("shows why the audit failed", () => {
        ui.click("#design-tab");
        ui.receive({ type: "DESIGN_AUDIT_FAILED", payload: { message: "page unavailable" } });

        expect(textOf(ui.get("#audit-status"))).toBe("The audit failed: page unavailable");
        expect(ui.get<HTMLButtonElement>("#run-audit").disabled).toBe(false);
        expect(textOf(ui.get("#run-audit-label"))).toBe("Run audit");
    });
});
