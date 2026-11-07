import { describe, expect, it } from "vitest";
import type { SrgbColor } from "#/core/audit/color/SrgbColor";
import {
    compositeOver,
    contrastRatio,
    formatContrastRatio,
    isLargeText,
    minimumContrast,
    relativeLuminance,
} from "#/core/audit/color/Wcag";

const WHITE: SrgbColor = { red: 1, green: 1, blue: 1, alpha: 1 };
const BLACK: SrgbColor = { red: 0, green: 0, blue: 0, alpha: 1 };

function gray(byte: number): SrgbColor {
    return { red: byte / 255, green: byte / 255, blue: byte / 255, alpha: 1 };
}

describe("relativeLuminance", () => {
    it("ranges from black to white", () => {
        expect(relativeLuminance(BLACK)).toBe(0);
        expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    });
});

describe("contrastRatio", () => {
    it("is 21 for black on white and 1 for identical colors", () => {
        expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
        expect(contrastRatio(gray(119), gray(119))).toBe(1);
    });

    it("does not depend on the order of the colors", () => {
        expect(contrastRatio(gray(119), WHITE)).toBe(contrastRatio(WHITE, gray(119)));
    });

    it("matches known pairs just around the AA minimum", () => {
        expect(contrastRatio(gray(0x76), WHITE)).toBeGreaterThan(4.5);
        expect(contrastRatio(gray(0x77), WHITE)).toBeLessThan(4.5);
    });
});

describe("compositeOver", () => {
    it("blends a translucent color with an opaque backdrop", () => {
        const blended = compositeOver({ ...BLACK, alpha: 0.5 }, WHITE);
        expect(blended.red).toBeCloseTo(0.5, 10);
        expect(blended.alpha).toBe(1);
    });

    it("keeps an opaque color as it is", () => {
        expect(compositeOver(gray(10), WHITE)).toEqual(gray(10));
    });

    it("yields transparency when both colors are transparent", () => {
        expect(compositeOver({ ...BLACK, alpha: 0 }, { ...WHITE, alpha: 0 }).alpha).toBe(0);
    });
});

describe("isLargeText", () => {
    it("counts 24px text at any weight and 18.66px bold text as large", () => {
        expect(isLargeText(24, 400)).toBe(true);
        expect(isLargeText(18.66, 700)).toBe(true);
        expect(isLargeText(18.66, 600)).toBe(false);
        expect(isLargeText(23.9, undefined)).toBe(false);
    });

    it("treats text of unknown size as normal text", () => {
        expect(isLargeText(undefined, 900)).toBe(false);
    });
});

describe("minimumContrast", () => {
    it("returns the WCAG thresholds", () => {
        expect(minimumContrast("AA", false)).toBe(4.5);
        expect(minimumContrast("AA", true)).toBe(3);
        expect(minimumContrast("AAA", false)).toBe(7);
        expect(minimumContrast("AAA", true)).toBe(4.5);
    });
});

describe("formatContrastRatio", () => {
    it("truncates instead of rounding, so a failing ratio never shows the threshold", () => {
        expect(formatContrastRatio(4.4999)).toBe("4.49:1");
        expect(formatContrastRatio(21)).toBe("21.00:1");
    });
});
