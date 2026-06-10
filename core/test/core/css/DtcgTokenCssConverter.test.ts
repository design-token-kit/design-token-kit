import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { DtcgTokenCssConverter } from "#/core/css/DtcgTokenCssConverter";

const FIXTURES = fileURLToPath(new URL("fixtures", import.meta.url));
const sources = [
    `${FIXTURES}/tokens.json`,
    `${FIXTURES}/tokens.dark.json`,
];

describe("DtcgTokenCssConverter", () => {
    const converter = new DtcgTokenCssConverter();
    let css: string;

    beforeAll(async () => {
        css = await converter.convert(sources);
    });

    it("generates :root block", () => {
        expect(css).toContain(":root {");
    });

    it("generates theme block", () => {
        expect(css).toContain(':root[data-theme="dark"] {');
    });

    it("converts color with alpha=1 using hex", () => {
        expect(css).toContain("--primitive-color-teal-500: #10a5a5");
    });

    it("converts color with alpha<1 using color() ignoring hex", () => {
        expect(css).toContain("--primitive-color-overlay: color(srgb 0 0 0 / 0.4)");
        expect(css).not.toContain("--primitive-color-overlay: #000000");
    });

    it("converts dimension to px", () => {
        expect(css).toContain("--primitive-spacing-4: 16px");
    });

    it("converts duration to ms", () => {
        expect(css).toContain("--primitive-transition-base: 200ms");
    });

    it("converts number as-is", () => {
        expect(css).toContain("--primitive-font-weight-bold: 700");
    });

    it("converts alias to var()", () => {
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-white)");
    });

    it("overrides dark theme values", () => {
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-white)");
        expect(css).toContain("--semantic-color-bg-surface: var(--primitive-color-slate-100)");
    });
});
