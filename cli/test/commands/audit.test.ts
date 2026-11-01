import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditCommand } from "#commands/audit";
import { run, dtokens } from "./_run";

const LOW_CONTRAST = resolve(__dirname, "audit-low-contrast.json");
const ACCESSIBLE = resolve(__dirname, "audit-accessible.json");
const UNCHECKED = "content:" + JSON.stringify({
    semantic: {
        color: {
            text: { "$type": "color", "$value": { colorSpace: "srgb", components: [0, 0, 0], alpha: 1 } },
            background: { "$type": "color", "$value": { colorSpace: "srgb", components: [1, 1, 1], alpha: 0.5 } },
        },
    },
});

describe("audit", () => {
    it("passes accessible tokens and prints the score", async () => {
        const result = await run(auditCommand, ACCESSIBLE);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Audit: 0 errors, 0 warnings, 0 not checked in 2 samples. Score 100 (A).");
    });

    it("does not print a score when no sample can be checked", async () => {
        const result = await run(auditCommand, UNCHECKED);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Audit: 0 errors, 0 warnings, 1 not checked in 1 sample. Score unavailable: no sample could be checked.");
    });

    it("reports contrast errors with exit code 2", async () => {
        const result = await run(auditCommand, LOW_CONTRAST);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain(
            "[text-contrast] error: " + LOW_CONTRAST + " - semantic.color.text-tertiary on semantic.color.background-canvas: "
            + "contrast 2.49:1 (#a1a4aa on #ffffff) is below 4.5:1, the WCAG AA minimum for normal text.",
        );
        expect(result.stderr).toContain("[text-size] warning:");
        expect(result.stdout).toContain("Audit: 1 error, 1 warning, 2 not checked in 5 samples. Score 98 (A).");
    });

    it("lists pairs it could not evaluate", async () => {
        const result = await run(auditCommand, LOW_CONTRAST);
        expect(result.stdout).toContain(
            "[text-contrast] not checked: " + LOW_CONTRAST + " - semantic.color.text-primary on semantic.color.background-glass: "
            + "the background is translucent (alpha 0.6), so the contrast depends on what lies behind it.",
        );
    });

    it("audits against AAA on request", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--level", "AAA");
        expect(result.status).toBe(0);
        expect(result.stderr).toContain("[text-contrast] warning:");
        expect(result.stderr).toContain("the WCAG AAA minimum for normal text");
    });

    it("reports a theme's own findings against the theme file", async () => {
        const theme = resolve(__dirname, "audit-accessible.dark.json");
        const result = await run(auditCommand, ACCESSIBLE, theme);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain(
            "[text-contrast] error: " + theme + " - semantic.color.text-secondary on semantic.color.background-canvas: contrast 1.00:1",
        );
        expect(result.stdout).toContain("Audit: 1 error, 0 warnings, 0 not checked in 3 samples. Score 98 (A).");
    });

    it("rejects an unknown level", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--level", "A");
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("Allowed choices are AA, AAA");
    });

    it("honours the rules allow-list and warns about unknown rules", async () => {
        const result = await run(auditCommand, LOW_CONTRAST, "--rules", "text-size,missing");
        expect(result.status).toBe(0);
        expect(result.stderr).toContain("warning: unknown audit rule 'missing'; skipped");
        expect(result.stderr).toContain("[text-size]");
        expect(result.stderr).not.toContain("[text-contrast]");
    });

    it("uses the configured minimum font size", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--min-font-size", "18");
        expect(result.stderr).toContain("font size 16px is below the 18px minimum for readable text.");
    });

    it("rejects a minimum font size that is not a positive number", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--min-font-size", "-3");
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("Expected a positive number.");
    });

    it("fails with exit code 1 on an unknown input format", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--inform", "pdf");
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Audit failed: Unknown format \"pdf\"");
    });

    it("reads the format given with --inform", async () => {
        const result = await run(auditCommand, ACCESSIBLE, "--inform", "dtcg");
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Score 100 (A).");
    });

    it("audits token content passed inline", async () => {
        const result = await run(auditCommand, "content:" + readFileSync(LOW_CONTRAST, "utf8"));
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("[text-contrast] error: content:");
    });

    it("reports unreadable sources with exit code 2", async () => {
        const result = await run(auditCommand, 'content:{"color": ');
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("[json-syntax]");
    });
});

describe("integration", () => {
    it("passes the playground set in both themes", () => {
        const result = dtokens(["audit", "examples/playground/tokens.json", "examples/playground/tokens.dark.json"]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Audit: 0 errors, 0 warnings, 0 not checked in 26 samples. Score 100 (A).");
    });

    it("passes the showcase set in all its themes", () => {
        const result = dtokens([
            "audit",
            "examples/tokens/showcase.dtcg.json",
            "examples/tokens/showcase.dark.dtcg.json",
            "examples/tokens/showcase.red.dtcg.json",
        ]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Audit: 0 errors, 1 warning");
    });

    it("reads the tokens from stdin when no file is given", () => {
        const result = dtokens(["audit"], readFileSync(LOW_CONTRAST, "utf8"));
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("[text-contrast] error: stdin - semantic.color.text-tertiary on semantic.color.background-canvas");
    });

    it("documents rules, pairing and exit codes in help", () => {
        const result = dtokens("audit --help");
        expect(result.stdout).toContain("Available rules:");
        expect(result.stdout).toContain("text-contrast");
        expect(result.stdout).toContain("How text is paired with backgrounds:");
        expect(result.stdout).toContain("Exit status:");
    });
});
