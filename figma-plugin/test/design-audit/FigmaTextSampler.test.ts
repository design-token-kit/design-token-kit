import { describe, expect, it } from "vitest";
import { contrastRatio, formatContrastRatio } from "@design-token-kit/core/core/audit/color/Wcag";
import { FigmaTextSampler } from "#/figma-plugin/design-audit/FigmaTextSampler";
import { booleanOperation, frame, gradient, group, image, page, rect, section, solid, text, textNodes } from "./figmaNodes";

const CARD = { x: 0, y: 0, width: 200, height: 100 };
const LABEL = { x: 20, y: 20, width: 80, height: 20 };
// Tall enough for several lines, so the line height is audited.
const PARAGRAPH = { x: 20, y: 20, width: 80, height: 60 };

function sampleOf(root: PageNode, includePage = false) {
    return new FigmaTextSampler().sample(textNodes(root), includePage);
}

function hex(color: { red: number; green: number; blue: number } | undefined): string | undefined {
    if (color === undefined) return undefined;
    return "#" + [color.red, color.green, color.blue].map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("");
}

describe("FigmaTextSampler", () => {
    it("reads the text colour, its typography and the fill of the frame behind it", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#f5f5f5")], [text("Caption", PARAGRAPH, { fills: [solid("#777777")], fontSize: 11 })]),
        ]));

        expect(hex(entry.sample.foreground)).toBe("#777777");
        expect(hex(entry.sample.background)).toBe("#f5f5f5");
        expect(entry.sample).toMatchObject({ id: "text:Caption", label: "Caption", fontSizePx: 11, fontWeight: 400, lineHeight: 1.5 });
        expect(entry.node).toEqual({ id: "text:Caption", name: "Caption", path: "Card", problem: undefined });
    });

    it("takes the background from a sibling painted below the text", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                rect("Badge", { x: 10, y: 10, width: 120, height: 40 }, [solid("#10b981")]),
                text("Label", LABEL),
            ]),
        ]));

        expect(hex(entry.sample.background)).toBe("#10b981");
    });

    it("does not treat a Boolean operation's bounding box as painted geometry", () => {
        const root = page("Page", [section("Grid variables", CARD, [solid("#ffffff")], [
            frame(" ", CARD, [], [
                frame("key", CARD, [], [
                    frame(".key", CARD, [], [
                        booleanOperation("Union", { x: 0, y: 0, width: 80, height: 20 }, [solid("#000000")], [
                            { windingRule: "NONZERO", data: "M 0 0 L 20 0 L 20 20 L 0 20 Z" },
                        ]),
                        text("KEY", { x: 40, y: 0, width: 40, height: 20 }),
                    ]),
                ]),
            ]),
        ])]);

        const [entry] = sampleOf(root);

        expect(hex(entry.sample.background)).toBe("#ffffff");
        expect(contrastRatio(entry.sample.foreground!, entry.sample.background!)).toBeGreaterThan(4.5);
    });

    it("requests manual review when Boolean geometry is unavailable", () => {
        const root = page("Page", [frame("Card", CARD, [solid("#ffffff")], [
            booleanOperation("Union", CARD, [solid("#000000")]),
            text("KEY", LABEL),
        ])]);

        const [entry] = sampleOf(root);

        expect(entry.node.problem).toBe("uncertain");
        expect(entry.sample.background).toBeUndefined();
    });

    it("keeps a genuine contrast failure when Boolean geometry covers the text", () => {
        const root = page("Page", [frame("Card", CARD, [solid("#ffffff")], [
            booleanOperation("Union", CARD, [solid("#000000")], [
                { windingRule: "NONZERO", data: "M 0 0 L 200 0 L 200 100 L 0 100 Z" },
            ]),
            text("KEY", LABEL),
        ])]);

        const [entry] = sampleOf(root);

        expect(hex(entry.sample.background)).toBe("#000000");
        expect(contrastRatio(entry.sample.foreground!, entry.sample.background!)).toBe(1);
    });

    it("finds a nested button surface when the text wrapper differs from the child wrapper", () => {
        const buttonSurface = { ...solid("#f5f5f5"), boundVariables: {
            color: { type: "VARIABLE_ALIAS", id: "variable:surface" },
        } } as Paint;
        const buttonText = { ...solid("#222222"), boundVariables: {
            color: { type: "VARIABLE_ALIAS", id: "variable:text" },
        } } as Paint;
        const root = page("Page", [frame("Button", CARD, [solid("#222222")], [
            rect("Surface", CARD, [buttonSurface]),
            text("KEY", LABEL, { fills: [buttonText] }),
        ])]);
        const original = textNodes(root)[0];
        const detached = { ...original, parent: original.parent } as TextNode;

        const [entry] = new FigmaTextSampler().sample([detached]);

        expect(entry.node.path).toBe("Button");
        expect(hex(entry.sample.foreground)).toBe("#222222");
        expect(hex(entry.sample.background)).toBe("#f5f5f5");
        expect(entry.sample.foreground?.alpha).toBe(1);
        expect(entry.sample.background?.alpha).toBe(1);
        expect(contrastRatio(entry.sample.foreground!, entry.sample.background!)).toBeGreaterThan(4.5);
    });

    it("reports manual review when the parent-child relationship is incomplete", () => {
        const root = page("Page", [frame("Button", CARD, [solid("#222222")], [text("KEY", LABEL)])]);
        const original = textNodes(root)[0];
        const incompleteParent = { ...frame("Unknown", CARD, [solid("#222222")], []), parent: null };
        const detached = { ...original, parent: incompleteParent } as unknown as TextNode;

        const [entry] = new FigmaTextSampler().sample([detached]);

        expect(entry.node.problem).toBe("uncertain");
        expect(entry.sample.colorProblem).toContain("could not be determined reliably");
        expect(entry.sample.background).toBeUndefined();
    });

    it("ignores siblings painted above the text or away from it", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                rect("Elsewhere", { x: 150, y: 60, width: 40, height: 30 }, [solid("#000000")]),
                text("Label", LABEL),
                rect("Above", LABEL, [solid("#ff0000")]),
            ]),
        ]));

        expect(hex(entry.sample.background)).toBe("#ffffff");
    });

    it("blends translucent layers down to the first opaque one", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                rect("Tint", CARD, [solid("#000000", 0.5)]),
                text("Label", LABEL, { fills: [solid("#000000", 0.5)] }),
            ]),
        ]));

        expect(hex(entry.sample.background)).toBe("#808080");
        expect(entry.sample.foreground?.alpha).toBe(0.5);
    });

    it("falls back to the page background, then to white", () => {
        expect(hex(sampleOf(page("Dark", [text("Free", LABEL)], [solid("#121212")]))[0].sample.background)).toBe("#121212");
        expect(hex(sampleOf(page("Bare", [text("Free", LABEL)], []))[0].sample.background)).toBe("#ffffff");
    });

    it("explains text on a gradient or with mixed colours", () => {
        const [onGradient, mixed] = sampleOf(page("Page", [
            frame("Hero", CARD, [gradient()], [text("Title", LABEL)]),
            frame("Card", CARD, [solid("#ffffff")], [text("Rich", LABEL, { fills: Symbol("mixed") })]),
        ]));

        expect(onGradient.node.problem).toBe("gradient");
        expect(onGradient.sample.colorProblem).toContain("gradient");
        expect(onGradient.sample.background).toBeUndefined();
        expect(mixed.node.problem).toBe("mixed");
    });

    it("skips hidden, empty and unfilled text", () => {
        const entries = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                text("Hidden", LABEL, { visible: false }),
                text("Empty", LABEL, { characters: "  " }),
                text("Unfilled", LABEL, { fills: [] }),
                text("Shown", LABEL),
            ]),
        ]));

        expect(entries.map((entry) => entry.node.name)).toEqual(["Shown"]);
    });

    it("skips text used as a shape and reviews symbolic text", () => {
        const entries = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                text("Mask", LABEL, { isMask: true }),
                { ...group("Logo", CARD, [text("Cut-out", LABEL)]), type: "BOOLEAN_OPERATION", fills: [solid("#000000")] },
                text("star", LABEL, { characters: "" }),
                text("Icon and label", LABEL, { characters: " Saved" }),
                text("Label", LABEL),
            ]),
        ]));

        expect(entries.map((entry) => entry.node.name)).toEqual(["star", "Icon and label", "Label"]);
        expect(entries[0].sample.manualReviewReason).toContain("private-use glyph");
        expect(entries[1].sample.manualReviewReason).toContain("private-use glyph");
        expect(entries[2].sample.manualReviewReason).toBeUndefined();
    });

    it("keeps readable single characters and keyboard labels as text", () => {
        const entries = sampleOf(page("Page", [frame("Card", CARD, [solid("#ffffff")], [
            text("Letter", LABEL, { characters: "A" }),
            text("Number", LABEL, { characters: "1" }),
            text("Shortcut", LABEL, { characters: "Ctrl+Enter" }),
            text("Tab", LABEL, { characters: "Tab" }),
        ])]));

        expect(entries.every((entry) => entry.sample.manualReviewReason === undefined)).toBe(true);
    });

    it("routes arrows and mixed graphical symbols to manual review", () => {
        const entries = sampleOf(page("Page", [frame("Card", CARD, [solid("#ffffff")], [
            text("Arrow", LABEL, { characters: "→", fills: [solid("#ff3737")] }),
            text("Arrow label", LABEL, { characters: "→ Next" }),
            text("Decorative star", LABEL, { characters: "★" }),
            text("Ascii arrow", LABEL, { characters: ">" }),
        ])]));

        expect(entries.map((entry) => entry.sample.manualReviewReason)).toEqual([
            expect.stringContaining("graphical symbol"),
            expect.stringContaining("graphical symbol"),
            expect.stringContaining("graphical symbol"),
            expect.stringContaining("graphical symbol"),
        ]);
        expect(formatContrastRatio(contrastRatio(entries[0].sample.foreground!, entries[0].sample.background!))).toBe("3.58:1");
    });

    it("audits the line height of wrapped text only", () => {
        const tight = { lineHeight: { unit: "PERCENT", value: 100 } } as const;
        const [single, tall, broken] = sampleOf(page("Page", [
            text("Single", LABEL, { ...tight, fontSize: 16 }),
            text("Tall", PARAGRAPH, { ...tight, fontSize: 16 }),
            text("Broken", LABEL, { ...tight, fontSize: 16, characters: "First line\nSecond line" }),
        ]));

        expect(single.sample.lineHeight).toBeUndefined();
        expect(tall.sample.lineHeight).toBe(1);
        expect(broken.sample.lineHeight).toBe(1);
    });

    it("converts pixel line heights and leaves auto line heights unknown", () => {
        const [pixels, auto] = sampleOf(page("Page", [
            text("Pixels", PARAGRAPH, { fontSize: 16, lineHeight: { unit: "PIXELS", value: 20 } }),
            text("Auto", PARAGRAPH, { lineHeight: { unit: "AUTO" } }),
        ]));

        expect(pixels.sample.lineHeight).toBe(1.25);
        expect(auto.sample.lineHeight).toBeUndefined();
    });

    it("explains text on an image", () => {
        const [entry] = sampleOf(page("Page", [frame("Hero", CARD, [image()], [text("Title", LABEL)])]));

        expect(entry.node.problem).toBe("image");
        expect(entry.sample.colorProblem).toContain("image");
    });

    it("explains gradient text", () => {
        const [entry] = sampleOf(page("Page", [frame("Card", CARD, [solid("#ffffff")], [text("Title", LABEL, { fills: [gradient()] })])]));

        expect(entry.node.problem).toBe("gradient");
        expect(entry.sample.foreground).toBeUndefined();
    });

    it("looks into groups painted below the text", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                group("Badge", CARD, [
                    rect("Shape", { x: 10, y: 10, width: 120, height: 40 }, [solid("#1d39da")]),
                    rect("Elsewhere", { x: 150, y: 60, width: 40, height: 30 }, [solid("#ff0000")]),
                ]),
                text("Label", LABEL),
            ]),
        ]));

        expect(hex(entry.sample.background)).toBe("#1d39da");
    });

    it("ignores hidden siblings, lines and other text below the text", () => {
        const [, entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                text("Under", LABEL, { fills: [solid("#ff0000")] }),
                rect("Hidden", CARD, [solid("#000000")], { visible: false }),
                { ...rect("Line", CARD, [solid("#00ff00")]), type: "LINE" },
                text("Label", LABEL),
            ]),
        ]));

        expect(entry.node.name).toBe("Label");
        expect(hex(entry.sample.background)).toBe("#ffffff");
    });

    it("skips paints that are hidden or fully transparent", () => {
        const hidden = { ...solid("#000000"), visible: false } as Paint;
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#fafafa"), hidden, solid("#000000", 0)], [text("Label", LABEL)]),
        ]));

        expect(hex(entry.sample.background)).toBe("#fafafa");
    });

    it("reads the fills of a section, which has no opacity of its own", () => {
        const [entry] = sampleOf(page("Page", [section("Flow", CARD, [solid("#e7f5f1")], [text("Label", LABEL)])]));

        expect(hex(entry.sample.background)).toBe("#e7f5f1");
    });

    it("blends the paints of a text fill into one colour", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [text("Label", LABEL, { fills: [solid("#ffffff"), solid("#000000", 0.5)] })]),
        ]));

        expect(hex(entry.sample.foreground)).toBe("#808080");
        expect(entry.sample.foreground?.alpha).toBe(1);
    });

    it("skips text inside a hidden frame and fully transparent text", () => {
        const entries = sampleOf(page("Page", [
            { ...frame("Hidden", CARD, [solid("#ffffff")], [text("Inside", LABEL)]), visible: false },
            frame("Card", CARD, [solid("#ffffff")], [text("Ghost", LABEL, { opacity: 0 })]),
        ]));

        expect(entries).toEqual([]);
    });

    it("inherits opacity from containing layers", () => {
        const card = {
            ...frame("Card", CARD, [], [
                rect("Surface", CARD, [solid("#000000")]),
                text("Label", LABEL),
            ]),
            opacity: 0.5,
        };

        const [entry] = sampleOf(page("Page", [card]));

        expect(entry.sample.foreground?.alpha).toBe(0.5);
        expect(hex(entry.sample.background)).toBe("#808080");
    });

    it("takes the smallest size and the lightest weight of mixed text", () => {
        const [entry] = sampleOf(page("Page", [
            text("Rich", LABEL, {
                fontSize: Symbol("mixed"),
                fontWeight: Symbol("mixed"),
                lineHeight: Symbol("mixed"),
                segments: [{ fontSize: 18, fontWeight: 700 }, { fontSize: 12, fontWeight: 400 }],
            }),
        ]));

        expect(entry.sample).toMatchObject({ fontSizePx: 12, fontWeight: 400, lineHeight: undefined });
    });

    it("measures the centre from the transform when the text has no bounds", () => {
        const [entry] = sampleOf(page("Page", [
            frame("Card", CARD, [solid("#ffffff")], [
                rect("Corner", { x: 0, y: 0, width: 30, height: 30 }, [solid("#000000")]),
                text("Label", { x: 25, y: 25, width: 0, height: 0 }, { absoluteBoundingBox: null }),
            ]),
        ]));

        expect(hex(entry.sample.background)).toBe("#000000");
    });

    it("starts the path with the page name on request", () => {
        const [entry] = sampleOf(page("Page", [frame("Card", CARD, [solid("#ffffff")], [text("Label", LABEL)])]), true);

        expect(entry.node.path).toBe("Page / Card");
    });
});
