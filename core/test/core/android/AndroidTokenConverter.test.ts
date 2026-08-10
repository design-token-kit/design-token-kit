import { describe, it, expect } from "vitest";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import {
    AndroidTokenConverter,
    type AndroidTokenConverterOptions,
} from "#/core/platforms/android/AndroidTokenConverter";
import type { AndroidTokenOutput } from "#/core/platforms/android/AndroidTokenOutput";

function convert(json: object, options?: AndroidTokenConverterOptions): string {
    const doc = new DtcgJsonReader().parse(JSON.stringify(json));
    return new AndroidTokenConverter(options).convertDocument(doc);
}

function convertResources(
    base: object,
    themes: Record<string, object> = {},
    options?: AndroidTokenConverterOptions,
): ReadonlyArray<AndroidTokenOutput> {
    const reader = new DtcgJsonReader();
    const baseDoc = reader.parse(JSON.stringify(base));
    const themeMap = new Map(
        Object.entries(themes).map(([name, doc]) => [name, reader.parse(JSON.stringify(doc))]),
    );
    return new AndroidTokenConverter(options).convertResourceList(new DtcgList(baseDoc, themeMap));
}

/**
 * Converts with the resource-type layout, so that assertions about resource
 * content can address a file by resource type rather than token group.
 */
function convertTyped(
    base: object,
    themes: Record<string, object> = {},
): ReadonlyArray<AndroidTokenOutput> {
    return convertResources(base, themes, { layout: "type" });
}

function fileNamed(outputs: ReadonlyArray<AndroidTokenOutput>, filePath: string): string {
    const output = outputs.find((candidate) => candidate.filePath === filePath);
    if (!output) throw new Error(`No output for ${filePath}, got ${outputs.map((o) => o.filePath).join(", ")}`);
    return output.content;
}

const RED = { colorSpace: "srgb", components: [1, 0, 0] };

describe("AndroidTokenConverter scalars", () => {
    it("wraps output in a resources element with an XML declaration", () => {
        const out = convert({ color: { red: { $type: "color", $value: RED } } });
        expect(out).toContain("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
        expect(out).toContain("<resources>");
        expect(out).toContain("</resources>");
    });

    it("emits colors as #AARRGGBB", () => {
        const out = convert({ color: { red: { $type: "color", $value: RED } } });
        expect(out).toContain("<color name=\"color_red\">#ffff0000</color>");
    });

    it("names resources in snake_case from the token path", () => {
        const out = convert({ color: { brandPrimary: { $type: "color", $value: RED } } });
        expect(out).toContain("name=\"color_brand_primary\"");
    });

    it("emits dimensions in dp", () => {
        const out = convert({ spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } });
        expect(out).toContain("<dimen name=\"spacing_md\">16dp</dimen>");
    });

    it("emits font size dimensions in sp", () => {
        const out = convert({
            font: { size: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } } },
        });
        expect(out).toContain("<dimen name=\"font_size_md\">16sp</dimen>");
    });

    it("resolves rem against the pixel base", () => {
        const out = convert({ spacing: { md: { $type: "dimension", $value: { value: 1.5, unit: "rem" } } } });
        expect(out).toContain("<dimen name=\"spacing_md\">24dp</dimen>");
    });

    it("resolves rem against a custom pixel base", () => {
        const out = convert(
            { spacing: { md: { $type: "dimension", $value: { value: 1.5, unit: "rem" } } } },
            { remBase: 10 },
        );
        expect(out).toContain("<dimen name=\"spacing_md\">15dp</dimen>");
    });

    it("emits durations as integers in milliseconds", () => {
        const out = convert({ motion: { fast: { $type: "duration", $value: { value: 0.2, unit: "s" } } } });
        expect(out).toContain("<integer name=\"motion_fast\">200</integer>");
    });

    it("emits whole numbers as integers", () => {
        const out = convert({ z: { modal: { $type: "number", $value: 1000 } } });
        expect(out).toContain("<integer name=\"z_modal\">1000</integer>");
    });

    it("emits fractional numbers as float items, preserving the fraction", () => {
        const out = convert({ line: { height: { $type: "number", $value: 1.5 } } });
        expect(out).toContain("<item name=\"line_height\" type=\"dimen\" format=\"float\">1.5</item>");
    });

    it("emits a font family as a single family, dropping CSS fallbacks", () => {
        const out = convert({ font: { body: { $type: "fontFamily", $value: ["Inter", "Arial", "sans-serif"] } } });
        expect(out).toContain("<string name=\"font_body\">Inter</string>");
        expect(out).not.toContain("Arial");
    });

    it("renders a token description as an XML comment", () => {
        const out = convert({
            color: { red: { $type: "color", $value: RED, $description: "Brand red" } },
        });
        expect(out).toContain("<!-- Brand red -->");
    });

    it("escapes XML special characters in values", () => {
        const out = convert({ label: { note: { $type: "fontFamily", $value: "a & b" } } });
        expect(out).toContain("a &amp; b");
    });
});

describe("AndroidTokenConverter references", () => {
    it("preserves color references as @color resource references", () => {
        const out = convert({
            color: {
                base: { red: { $type: "color", $value: RED } },
                semantic: { primary: { $type: "color", $value: "{color.base.red}" } },
            },
        });
        expect(out).toContain("<color name=\"color_semantic_primary\">@color/color_base_red</color>");
    });

    it("preserves dimension references as @dimen resource references", () => {
        const outputs = convertTyped({
            space: {
                $type: "dimension",
                base: { $value: { value: 8, unit: "px" } },
                inset: { $value: "{space.base}" },
            },
        });
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"space_inset\">@dimen/space_base</dimen>");
    });

    it("types an alias without a declared type after its target", () => {
        const outputs = convertTyped({
            space: { base: { $type: "dimension", $value: { value: 8, unit: "px" } } },
            component: { padding: { $value: "{space.base}" } },
        });
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"component_padding\">@dimen/space_base</dimen>");
    });

    it("decomposes an alias to a composite into per-field references", () => {
        const outputs = convertTyped({
            border: {
                base: {
                    $type: "border",
                    $value: { color: RED, width: { value: 1, unit: "px" }, style: "solid" },
                },
                strong: { $type: "border", $value: "{border.base}" },
            },
        });
        expect(fileNamed(outputs, "values/colors.xml"))
            .toContain("<color name=\"border_strong_color\">@color/border_base_color</color>");
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"border_strong_width\">@dimen/border_base_width</dimen>");
    });

    it("keeps a font family alias as a single reference", () => {
        const out = convert({
            font: {
                $type: "fontFamily",
                body: { $value: ["Inter", "Arial"] },
                heading: { $value: "{font.body}" },
            },
        });
        expect(out).toContain("<string name=\"font_heading\">@string/font_body</string>");
    });

    it("types a number alias after the value it resolves to", () => {
        const outputs = convertTyped({
            num: {
                $type: "number",
                whole: { $value: 1000 },
                frac: { $value: 1.5 },
                aliasWhole: { $value: "{num.whole}" },
                aliasFrac: { $value: "{num.frac}" },
            },
        });
        expect(fileNamed(outputs, "values/integers.xml"))
            .toContain("<integer name=\"num_alias_whole\">@integer/num_whole</integer>");
        expect(fileNamed(outputs, "values/floats.xml"))
            .toContain("<item name=\"num_alias_frac\" type=\"dimen\" format=\"float\">@dimen/num_frac</item>");
    });
});

describe("AndroidTokenConverter composites", () => {
    it("decomposes typography into one resource per field", () => {
        const outputs = convertTyped({
            typography: {
                body: {
                    $type: "typography",
                    $value: {
                        fontFamily: "Inter",
                        fontSize: { value: 16, unit: "px" },
                        fontWeight: 400,
                        letterSpacing: { value: 0.5, unit: "px" },
                        lineHeight: 1.5,
                    },
                },
            },
        });
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"typography_body_font_size\">16sp</dimen>");
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"typography_body_letter_spacing\">0.5sp</dimen>");
        expect(fileNamed(outputs, "values/floats.xml"))
            .toContain("name=\"typography_body_line_height\"");
        expect(fileNamed(outputs, "values/integers.xml"))
            .toContain("<integer name=\"typography_body_font_weight\">400</integer>");
        expect(fileNamed(outputs, "values/strings.xml"))
            .toContain("<string name=\"typography_body_font_family\">Inter</string>");
    });

    it("decomposes a shadow into color and dimension resources", () => {
        const outputs = convertTyped({
            shadow: {
                card: {
                    $type: "shadow",
                    $value: {
                        color: RED,
                        offsetX: { value: 0, unit: "px" },
                        offsetY: { value: 2, unit: "px" },
                        blur: { value: 4, unit: "px" },
                        spread: { value: 0, unit: "px" },
                    },
                },
            },
        });
        expect(fileNamed(outputs, "values/colors.xml"))
            .toContain("<color name=\"shadow_card_color\">#ffff0000</color>");
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"shadow_card_blur\">4dp</dimen>");
    });

    it("decomposes a border into color and width resources", () => {
        const outputs = convertTyped({
            border: {
                subtle: {
                    $type: "border",
                    $value: { color: RED, width: { value: 1, unit: "px" }, style: "solid" },
                },
            },
        });
        expect(fileNamed(outputs, "values/colors.xml"))
            .toContain("<color name=\"border_subtle_color\">#ffff0000</color>");
        expect(fileNamed(outputs, "values/dimens.xml"))
            .toContain("<dimen name=\"border_subtle_width\">1dp</dimen>");
    });

    it("decomposes a transition into duration and delay resources", () => {
        const out = convert({
            transition: {
                fade: {
                    $type: "transition",
                    $value: {
                        duration: { value: 200, unit: "ms" },
                        delay: { value: 0, unit: "ms" },
                        timingFunction: [0, 0, 1, 1],
                    },
                },
            },
        });
        expect(out).toContain("<integer name=\"transition_fade_duration\">200</integer>");
        expect(out).toContain("<integer name=\"transition_fade_delay\">0</integer>");
    });

    it("decomposes gradient stops by index", () => {
        const outputs = convertTyped({
            gradient: {
                brand: {
                    $type: "gradient",
                    $value: [
                        { color: RED, position: 0 },
                        { color: RED, position: 1 },
                    ],
                },
            },
        });
        expect(fileNamed(outputs, "values/colors.xml"))
            .toContain("<color name=\"gradient_brand_0_color\">#ffff0000</color>");
        expect(fileNamed(outputs, "values/integers.xml"))
            .toContain("<integer name=\"gradient_brand_1_position\">1</integer>");
    });
});

describe("AndroidTokenConverter resource files", () => {
    const LAYERED = {
        primitive: { color: { red: { $type: "color", $value: RED } } },
        semantic: {
            color: { primary: { $type: "color", $value: "{primitive.color.red}" } },
            space: { md: { $type: "dimension", $value: { value: 8, unit: "px" } } },
        },
    };

    it("splits resources by root token group by default", () => {
        const outputs = convertResources(LAYERED);
        expect(outputs.map((output) => output.filePath).sort())
            .toEqual(["values/primitive.xml", "values/semantic.xml"]);
    });

    it("keeps resources of different types of one group in one file", () => {
        const outputs = convertResources(LAYERED);
        const semantic = fileNamed(outputs, "values/semantic.xml");
        expect(semantic).toContain("<color name=\"semantic_color_primary\">");
        expect(semantic).toContain("<dimen name=\"semantic_space_md\">8dp</dimen>");
    });

    it("splits resources by resource type for the type layout", () => {
        const outputs = convertResources(LAYERED, {}, { layout: "type" });
        expect(outputs.map((output) => output.filePath).sort())
            .toEqual(["values/colors.xml", "values/dimens.xml"]);
    });

    it("collects tokens declared at the document root under a shared file", () => {
        const outputs = convertResources({ red: { $type: "color", $value: RED } });
        expect(outputs.map((output) => output.filePath)).toEqual(["values/tokens.xml"]);
    });

    it("opens a commented section per second-level token group", () => {
        const out = convert({
            semantic: {
                color: { primary: { $type: "color", $value: RED } },
                space: { md: { $type: "dimension", $value: { value: 8, unit: "px" } } },
            },
        });
        expect(out).toContain("<!-- semantic.color -->");
        expect(out).toContain("<!-- semantic.space -->");
    });

    it("renders the group description in the section header", () => {
        const out = convert({
            semantic: {
                color: {
                    $description: "Semantic colors",
                    primary: { $type: "color", $value: RED },
                },
            },
        });
        expect(out).toContain("<!-- semantic.color");
        expect(out).toContain("Semantic colors");
    });

    it("keeps resources of nested groups in the section their ancestor opened", () => {
        const out = convert({
            semantic: {
                color: {
                    background: { canvas: { $type: "color", $value: RED } },
                    text: { primary: { $type: "color", $value: RED } },
                },
            },
        });
        expect(out.match(/<!-- semantic/g)).toHaveLength(1);
        expect(out).toContain("<!-- semantic.color -->");
    });

    it("opens no section for tokens declared outside a group", () => {
        const out = convert({ red: { $type: "color", $value: RED } });
        expect(out).not.toContain("<!-- red");
    });

    it("marks base document outputs as base", () => {
        const outputs = convertResources({ color: { red: { $type: "color", $value: RED } } });
        expect(outputs[0].isBase).toBe(true);
        expect(outputs[0].themeName).toBe("base");
    });

    it("throws from convertList when the output spans multiple files", () => {
        expect(() => convert(LAYERED)).toThrow(/multiple resource files/);
    });
});

describe("AndroidTokenConverter themes", () => {
    const BASE = { color: { bg: { $type: "color", $value: RED } } };
    const DARK = { color: { bg: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0] } } } };

    it("writes the dark theme into values-night", () => {
        const outputs = convertTyped(BASE, { dark: DARK });
        expect(fileNamed(outputs, "values-night/colors.xml"))
            .toContain("<color name=\"color_bg\">#ff000000</color>");
    });

    it("writes other themes into a qualified values directory", () => {
        const outputs = convertTyped(BASE, { red: DARK });
        expect(outputs.some((output) => output.filePath === "values-red/colors.xml")).toBe(true);
    });

    it("emits only the theme overrides, relying on resource qualifier fallback", () => {
        const outputs = convertTyped(
            {
                color: {
                    bg: { $type: "color", $value: RED },
                    fg: { $type: "color", $value: RED },
                },
            },
            { dark: DARK },
        );
        const night = fileNamed(outputs, "values-night/colors.xml");
        expect(night).toContain("color_bg");
        expect(night).not.toContain("color_fg");
    });

    it("marks theme outputs with their theme name", () => {
        const outputs = convertTyped(BASE, { dark: DARK });
        const night = outputs.find((output) => output.filePath === "values-night/colors.xml");
        expect(night?.themeName).toBe("dark");
        expect(night?.isBase).toBe(false);
    });

    it("rejects convertList for multi-theme input", () => {
        const reader = new DtcgJsonReader();
        const list = new DtcgList(
            reader.parse(JSON.stringify(BASE)),
            new Map([["dark", reader.parse(JSON.stringify(DARK))]]),
        );
        expect(() => new AndroidTokenConverter().convertList(list)).toThrow(/multi-theme/);
    });
});
