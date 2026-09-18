import { describe, it, expect } from "vitest";
import { HrdtTokenReader } from "#/core/io/HrdtTokenReader";
import { HrdtTokenWriter } from "#/core/io/HrdtTokenWriter";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { BorderToken } from "#/core/model/tokens/BorderToken";
import { CubicBezierToken } from "#/core/model/tokens/CubicBezierToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { DurationToken } from "#/core/model/tokens/DurationToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { GradientToken } from "#/core/model/tokens/GradientToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { ShadowToken } from "#/core/model/tokens/ShadowToken";
import { StrokeStyleToken } from "#/core/model/tokens/StrokeStyleToken";
import { TransitionToken } from "#/core/model/tokens/TransitionToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

// A small but representative HRDT document: the three layers plus an alias,
// enough to exercise reader <-> writer round-trips.
const SAMPLE: string = `
primitive:
  color:
    white: "#ffffff"
    brand:
      500: "#2549f6"
  dimension:
    space-100: 4px
semantic:
  color:
    background-page: "{primitive.color.white}"
    action-primary: "{primitive.color.brand.500}"
component:
  button:
    primary:
      background: "{semantic.color.background-page}"
`;

function write(doc: Dtcg): string {
    return new HrdtTokenWriter().write(doc);
}

describe("HrdtTokenWriter", () => {
    // Round-trip: reader and writer agree on a representative document.
    describe("round-trip", () => {
        it("produces output readable by HrdtTokenReader", () => {
            const doc = new HrdtTokenReader().parse(SAMPLE);
            const written = new HrdtTokenWriter().write(doc);
            expect(() => new HrdtTokenReader().parse(written)).not.toThrow();
        });

        it("preserves top-level group keys", () => {
            const doc = new HrdtTokenReader().parse(write(new HrdtTokenReader().parse(SAMPLE)));
            expect([...doc.keys()]).toEqual(["primitive", "semantic", "component"]);
        });

        it("preserves nested color palette steps", () => {
            const written = write(new HrdtTokenReader().parse(SAMPLE));

            expect(written).toContain("    brand:\n      500: \"#2549f6\"");
            expect(written).toContain('action-primary: "{primitive.color.brand.500}"');
        });
    });

    describe("writes tokens", () => {
        it("writes color token as hex string", () => {
            const token = new ColorToken(new ColorValue("srgb", [1, 0, 0], 1, "#ff0000"));
            const colors = new TokenGroup({ children: new Map([["red", token]]) });
            const primitive = new TokenGroup({ children: new Map([["color", colors]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('red: "#ff0000"');
        });

        it("writes computed color components with alpha", () => {
            const token = new ColorToken(new ColorValue("srgb", [0.1, "none", 1], 0.5));
            const colors = new TokenGroup({ children: new Map([["computed", token]]) });
            const primitive = new TokenGroup({ children: new Map([["color", colors]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });

            expect(write(new Dtcg(root))).toContain('computed: "#1a00ff80"');
        });

        it("writes dimension token", () => {
            const token = new DimensionToken(new DimensionValue(8, "px"));
            const dimensions = new TokenGroup({ children: new Map([["space", token]]) });
            const primitive = new TokenGroup({ children: new Map([["dimension", dimensions]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("space: 8px");
        });

        it("writes number token", () => {
            const token = new NumberToken(1.5);
            const numbers = new TokenGroup({ children: new Map([["ratio", token]]) });
            const primitive = new TokenGroup({ children: new Map([["number", numbers]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain("ratio: 1.5");
        });

        it("writes standalone stroke style objects and keywords", () => {
            const styles = new TokenGroup({ children: new Map([
                ["dashed", new StrokeStyleToken(new StrokeStyleObject([new DimensionValue(4, "px")], "round"))],
                ["solid", new StrokeStyleToken("solid")],
            ]) });
            const primitive = new TokenGroup({ children: new Map([["strokeStyle", styles]]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });

            const result = write(new Dtcg(root));

            expect(result).toContain("dashed:\n      dashArray: [4px]\n      lineCap: round");
            expect(result).toContain("solid: solid");
        });
    });

    describe("writes aliases", () => {
        it("writes token reference as quoted curly-brace string", () => {
            const token = new ColorToken(new TokenReference("primitive.color.white"));
            const colors = new TokenGroup({ children: new Map([["bg", token]]) });
            const semantic = new TokenGroup({ children: new Map([["color", colors]]) });
            const root = new TokenGroup({ children: new Map([["semantic", semantic]]) });
            const result = write(new Dtcg(root));
            expect(result).toContain('bg: "{primitive.color.white}"');
        });
    });

    describe("writes compound token values", () => {
        it("writes YAML objects, lists, and nested references", () => {
            const black = new ColorValue("srgb", [0, 0, 0]);
            const pixel = new DimensionValue(2, "px");
            const duration = new DurationValue(150, "ms");
            const easing = new CubicBezierValue(0.2, 0, 0, 1);
            const primitive = new TokenGroup({ children: new Map([
                ["border", new TokenGroup({ children: new Map([["default", new BorderToken(
                    new BorderValue(black, pixel, new StrokeStyleObject([pixel], "round")),
                )]]) })],
                ["cubicBezier", new TokenGroup({ children: new Map([["standard", new CubicBezierToken(easing)]]) })],
                ["duration", new TokenGroup({ children: new Map([["fast", new DurationToken(duration)]]) })],
                ["fontFamily", new TokenGroup({ children: new Map([["body", new FontFamilyToken(["Inter", "sans serif"])]]) })],
                ["gradient", new TokenGroup({ children: new Map([["fade", new GradientToken([
                    new GradientStop(black, 0),
                    new TokenReference("primitive.color.white"),
                ])]]) })],
                ["shadow", new TokenGroup({ children: new Map([["raised", new ShadowToken([
                    new ShadowLayer(black, pixel, pixel, pixel, pixel, true),
                    new TokenReference("primitive.shadow.subtle"),
                ])]]) })],
                ["transition", new TokenGroup({ children: new Map([["enter", new TransitionToken(
                    new TransitionValue(duration, new TokenReference("primitive.duration.fast"), easing),
                )]]) })],
                ["typography", new TokenGroup({ children: new Map([["body", new TypographyToken(
                    new TypographyValue("Inter", pixel, 400, pixel, 1.5),
                )]]) })],
            ]) });
            const root = new TokenGroup({ children: new Map([["primitive", primitive]]) });

            const result = write(new Dtcg(root));

            expect(result).toContain("style: {dashArray: [2px], lineCap: round}");
            expect(result).toContain("standard: [0.2, 0, 0, 1]");
            expect(result).toContain("body: [Inter, \"sans serif\"]");
            expect(result).toContain("- \"{primitive.color.white}\"");
            expect(result).toContain("inset: true");
            expect(result).toContain('delay: "{primitive.duration.fast}"');
            expect(result).toContain("fontFamily: Inter");
            expect(() => new HrdtTokenReader().parse(result)).not.toThrow();
        });
    });
});
