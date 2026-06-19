import { describe, it, expect } from "vitest";
import { TokenLayers } from "#/core/check/TokenLayers";
import { TokenPath } from "#/core/model/TokenPath";

describe("TokenLayers", () => {
    it("defaults to primitive/semantic/component", () => {
        expect(TokenLayers.default().names()).toEqual(["primitive", "semantic", "component"]);
    });

    it("reports the lowest layer", () => {
        expect(TokenLayers.default().lowest()).toBe("primitive");
        expect(new TokenLayers(["base", "alias"]).lowest()).toBe("base");
    });

    it("derives the layer from the first path segment", () => {
        const layers = TokenLayers.default();
        expect(layers.layerOf(TokenPath.parse("component.button.bg"))).toBe("component");
        expect(layers.layerOf(TokenPath.parse("primitive.color.red"))).toBe("primitive");
    });

    it("returns undefined for unconfigured first segment", () => {
        expect(TokenLayers.default().layerOf(TokenPath.parse("custom.foo"))).toBeUndefined();
    });

    it("allows only adjacent lower-layer edges", () => {
        const layers = TokenLayers.default();
        expect(layers.isAllowedEdge("component", "semantic")).toBe(true);
        expect(layers.isAllowedEdge("semantic", "primitive")).toBe(true);
        expect(layers.isAllowedEdge("component", "primitive")).toBe(false);
        expect(layers.isAllowedEdge("semantic", "component")).toBe(false);
        expect(layers.isAllowedEdge("component", "component")).toBe(false);
        expect(layers.isAllowedEdge("primitive", "semantic")).toBe(false);
    });

    it("honours a custom layer order", () => {
        const layers = new TokenLayers(["base", "alias", "comp"]);
        expect(layers.isAllowedEdge("comp", "alias")).toBe(true);
        expect(layers.isAllowedEdge("comp", "base")).toBe(false);
    });
});
