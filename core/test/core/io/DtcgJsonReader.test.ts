import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DtcgJsonReader, DtcgJsonReaderError } from "#/core/io/DtcgJsonReader";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { DurationToken } from "#/core/model/tokens/DurationToken";
import { CubicBezierToken } from "#/core/model/tokens/CubicBezierToken";
import { StrokeStyleToken } from "#/core/model/tokens/StrokeStyleToken";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { BorderValue } from "#/core/model/values/BorderValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

const TOKENS_DIR = resolve(__dirname, "../../../tokens");

async function loadFixture(name: string): Promise<Dtcg> {
    return new DtcgJsonReader().parse(await readFile(resolve(TOKENS_DIR, name), "utf8"));
}

function getGroup(doc: Dtcg, ...path: string[]): TokenGroup {
    let node: ReturnType<Dtcg["get"]> = doc.get(path[0]);
    for (const key of path.slice(1)) {
        node = (node as TokenGroup).get(key);
    }
    return node as TokenGroup;
}

function getToken(doc: Dtcg, ...path: string[]): TokenNode<unknown> {
    const group = getGroup(doc, ...path.slice(0, -1));
    return group.get(path[path.length - 1]) as TokenNode<unknown>;
}

describe("DtcgJsonReader", () => {
    describe("document structure", () => {
        it("parses top-level groups", async () => {
            const doc = await loadFixture("valid.json");
            expect([...doc.keys()]).toContain("primitive");
            expect([...doc.keys()]).toContain("semantic");
            expect([...doc.keys()]).toContain("component");
        });

        it("returns Dtcg instance", async () => {
            const doc = await loadFixture("valid.json");
            expect(doc).toBeInstanceOf(Dtcg);
        });

        it("parses nested group structure", async () => {
            const doc = await loadFixture("valid.json");
            const primitive = doc.get("primitive");
            expect(primitive).toBeInstanceOf(TokenGroup);
            const color = (primitive as TokenGroup).get("color");
            expect(color).toBeInstanceOf(TokenGroup);
        });
    });

    describe("color tokens", () => {
        it("parses color with sRGB components", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "color", "white");
            expect(token).toBeInstanceOf(ColorToken);
            const value = (token as ColorToken).value as ColorValue;
            expect(value.colorSpace).toBe("srgb");
            expect(value.components).toEqual([1, 1, 1]);
            expect(value.alpha).toBe(1);
            expect(value.hex).toBe("#ffffff");
        });

        it("parses color with alpha < 1", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "color", "overlay-40") as ColorToken;
            const value = token.value as ColorValue;
            expect(value.alpha).toBe(0.4);
        });
    });

    describe("dimension tokens", () => {
        it("parses dimension in px", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "dimension", "space-100") as DimensionToken;
            const value = token.value as DimensionValue;
            expect(value.value).toBe(4);
            expect(value.unit).toBe("px");
        });
    });

    describe("fontFamily tokens", () => {
        it("parses font family array", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "fontFamily", "body") as FontFamilyToken;
            expect(token.value).toEqual(["Inter", "Arial", "sans-serif"]);
        });
    });

    describe("fontWeight tokens", () => {
        it("parses keyword font weight", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "fontWeight", "regular") as FontWeightToken;
            expect(token.value).toBe("regular");
        });

        it("parses numeric font weight", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "fontWeight", "medium") as FontWeightToken;
            expect(token.value).toBe(500);
        });
    });

    describe("number tokens", () => {
        it("parses number value", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "number", "line-height-normal") as NumberToken;
            expect(token.value).toBe(1.5);
        });
    });

    describe("duration tokens", () => {
        it("parses duration in ms", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "duration", "fast") as DurationToken;
            const value = token.value as DurationValue;
            expect(value.value).toBe(120);
            expect(value.unit).toBe("ms");
        });
    });

    describe("cubicBezier tokens", () => {
        it("parses cubic bezier control points", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "cubicBezier", "standard") as CubicBezierToken;
            const value = token.value as CubicBezierValue;
            expect(value.p1x).toBe(0.2);
            expect(value.p1y).toBe(0);
            expect(value.p2x).toBe(0);
            expect(value.p2y).toBe(1);
        });
    });

    describe("strokeStyle tokens", () => {
        it("parses keyword stroke style", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "strokeStyle", "solid") as StrokeStyleToken;
            expect(token.value).toBe("solid");
        });

        it("parses object stroke style with dashArray", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "strokeStyle", "dashed-round") as StrokeStyleToken;
            const value = token.value as StrokeStyleObject;
            expect(value).toBeInstanceOf(StrokeStyleObject);
            expect(value.lineCap).toBe("round");
            expect(value.dashArray).toHaveLength(2);
            expect((value.dashArray[0] as DimensionValue).value).toBe(8);
        });
    });

    describe("border tokens", () => {
        it("parses border with color, width, and style", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "border", "subtle") as BorderToken;
            const value = token.value as BorderValue;
            expect(value).toBeInstanceOf(BorderValue);
            expect((value.color as ColorValue).colorSpace).toBe("srgb");
            expect((value.width as DimensionValue).value).toBe(1);
            expect(value.style).toBe("solid");
        });

        it("parses border with object stroke style", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "border", "focus-ring") as BorderToken;
            const value = token.value as BorderValue;
            expect(value.style).toBeInstanceOf(StrokeStyleObject);
        });
    });

    describe("transition tokens", () => {
        it("parses transition with duration, delay, timingFunction", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "transition", "standard") as TransitionToken;
            const value = token.value as TransitionValue;
            expect(value).toBeInstanceOf(TransitionValue);
            expect((value.duration as DurationValue).value).toBe(120);
            expect((value.delay as DurationValue).value).toBe(0);
            expect(value.timingFunction).toBeInstanceOf(CubicBezierValue);
        });
    });

    describe("shadow tokens", () => {
        it("parses single-layer shadow", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "shadow", "surface") as ShadowToken;
            const value = token.value as ShadowLayer;
            expect(value).toBeInstanceOf(ShadowLayer);
            expect((value.offsetY as DimensionValue).value).toBe(4);
            expect(value.inset).toBe(false);
        });

        it("parses multi-layer shadow as array", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "shadow", "overlay") as ShadowToken;
            const value = token.value as ShadowLayer[];
            expect(Array.isArray(value)).toBe(true);
            expect(value).toHaveLength(2);
            expect(value[0]).toBeInstanceOf(ShadowLayer);
        });
    });

    describe("gradient tokens", () => {
        it("parses gradient stops", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "gradient", "brand") as GradientToken;
            const value = token.value as GradientStop[];
            expect(Array.isArray(value)).toBe(true);
            expect(value).toHaveLength(2);
            expect(value[0]).toBeInstanceOf(GradientStop);
            expect(value[0].position).toBe(0);
            expect(value[1].position).toBe(1);
        });
    });

    describe("typography tokens", () => {
        it("parses typography composite value", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "primitive", "typography", "body-sm") as TypographyToken;
            const value = token.value as TypographyValue;
            expect(value).toBeInstanceOf(TypographyValue);
            expect(value.fontFamily).toEqual(["Inter", "Arial", "sans-serif"]);
            expect((value.fontSize as DimensionValue).value).toBe(14);
            expect(value.fontWeight).toBe("regular");
            expect(value.lineHeight).toBe(1.5);
        });
    });

    describe("aliases (token references)", () => {
        it("parses curly-brace alias as TokenReference", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "semantic", "color", "background-page");
            expect(token!.isAlias()).toBe(true);
            const ref = token!.value as TokenReference;
            expect(ref).toBeInstanceOf(TokenReference);
            expect(ref.value).toBe("primitive.color.white");
        });

        it("preserves alias path exactly", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "semantic", "color", "action-primary");
            expect((token!.value as TokenReference).value).toBe("primitive.color.brand-500");
        });

        it("parses deeply nested alias", async () => {
            const doc = await loadFixture("valid.json");
            const token = getToken(doc, "component", "button", "primary", "background");
            expect(token!.isAlias()).toBe(true);
            expect((token!.value as TokenReference).value).toBe("semantic.color.action-primary");
        });
    });

    describe("type inheritance", () => {
        it("inherits $type from parent group", () => {
            const parser = new DtcgJsonReader();
            const doc = parser.parse(JSON.stringify({
                "$schema": "",
                "colors": {
                    "$type": "color",
                    "red": {
                        "$value": { "colorSpace": "srgb", "components": [1, 0, 0] },
                    },
                },
            }));
            const token = getToken(doc, "colors", "red");
            expect(token).toBeInstanceOf(ColorToken);
            expect(token!.type).toBe("color");
        });

        it("overrides inherited type at token level", () => {
            const parser = new DtcgJsonReader();
            const doc = parser.parse(JSON.stringify({
                "$schema": "",
                "mixed": {
                    "$type": "color",
                    "opacity": {
                        "$type": "number",
                        "$value": 0.5,
                    },
                },
            }));
            const token = getToken(doc, "mixed", "opacity");
            expect(token).toBeInstanceOf(NumberToken);
            expect(token!.type).toBe("number");
        });
    });

    describe("error handling", () => {
        it("throws DtcgJsonReaderError for token without type", () => {
            const parser = new DtcgJsonReader();
            expect(() => parser.parse(JSON.stringify({
                "$schema": "",
                "token": { "$value": 42 },
            }))).toThrow(DtcgJsonReaderError);
        });
    });
});
