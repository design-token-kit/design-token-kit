import { describe, expect, it } from "vitest";
import { colorRole, nameWords, normalizedPath } from "#/core/audit/tokens/ColorRole";
import { TokenPath } from "#/core/model/TokenPath";

function role(path: string) {
    return colorRole(TokenPath.parse(path));
}

describe("nameWords", () => {
    it("splits kebab, snake and camel case names", () => {
        expect(nameWords("text-Primary")).toEqual(["text", "primary"]);
        expect(nameWords("text_primary")).toEqual(["text", "primary"]);
        expect(nameWords("textPrimary")).toEqual(["text", "primary"]);
    });
});

describe("normalizedPath", () => {
    it("normalizes every segment", () => {
        expect(normalizedPath(TokenPath.parse("semantic.colorText.onBrand"))).toBe("semantic.color-text.on-brand");
    });
});

describe("colorRole", () => {
    it("reads text and background colors in the same group", () => {
        expect(role("semantic.color.text-primary")).toEqual({ kind: "foreground", context: "semantic.color", inverse: false, targets: undefined });
        expect(role("semantic.color.background-canvas")).toEqual({ kind: "background", context: "semantic.color", inverse: false, targets: undefined });
        expect(role("semantic.color.surface")).toMatchObject({ kind: "background", context: "semantic.color" });
    });

    it("reads role groups and role words at the end of a segment", () => {
        expect(role("semantic.color.text.primary")).toMatchObject({ kind: "foreground", context: "semantic.color" });
        expect(role("component.button.primary.text")).toMatchObject({ kind: "foreground", context: "component.button.primary" });
        expect(role("component.button.label-text")).toMatchObject({ kind: "foreground", context: "component.button" });
        expect(role("component.button.primary.background-hover")).toMatchObject({ kind: "background", context: "component.button.primary" });
    });

    it("marks inverse colors", () => {
        expect(role("semantic.color.text-inverse")).toMatchObject({ inverse: true });
        expect(role("semantic.color.background-inverse")).toMatchObject({ inverse: true });
    });

    it("targets the background named by on-X colors", () => {
        expect(role("semantic.color.on-primary")?.targets).toEqual([
            "semantic.color.primary",
            "semantic.color.background-primary",
            "semantic.color.bg-primary",
            "semantic.color.surface-primary",
            "semantic.color.background.primary",
            "semantic.color.bg.primary",
            "semantic.color.surface.primary",
        ]);
        expect(role("color.on.brand")?.targets?.[0]).toBe("color.brand");
        expect(role("color.text-on-brand")?.targets?.[0]).toBe("color.brand");
    });

    it("targets backgrounds at the root for on-X colors at the root", () => {
        expect(role("on-brand")?.targets?.slice(0, 2)).toEqual(["brand", "background-brand"]);
    });

    it("skips segments without words", () => {
        expect(role("--.text-primary")).toMatchObject({ kind: "foreground", context: "" });
    });

    it("ignores colors with no role, both roles, or no text on them", () => {
        expect(role("semantic.color.border-strong")).toBeUndefined();
        expect(role("primitive.color.blue.500")).toBeUndefined();
        expect(role("semantic.color.text-background")).toBeUndefined();
        expect(role("semantic.color.background-overlay")).toBeUndefined();
        expect(role("color.on")).toBeUndefined();
    });

    it("exempts disabled colors, as WCAG does", () => {
        expect(role("semantic.color.text-disabled")).toBeUndefined();
        expect(role("component.button.disabled.background")).toBeUndefined();
    });
});
