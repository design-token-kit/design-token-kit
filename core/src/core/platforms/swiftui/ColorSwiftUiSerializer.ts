import { ColorValue, type ColorComponent, type ColorSpace } from "#/core/model/values/ColorValue";

const SPACE_MAP: Partial<Record<ColorSpace, string>> = {
    "srgb": ".sRGB",
    "srgb-linear": ".linearSRGB",
    "display-p3": ".displayP3",
};

/**
 * Serializes DTCG color values to SwiftUI Color initializers.
 *
 * @remarks
 * Unsupported color spaces (lab, lch, oklab, oklch, hsl, ...) fall back to
 * sRGB. Components are emitted as raw 0-1 numbers; `opacity:` is added only
 * when alpha is below 1.
 */
export class ColorSwiftUiSerializer {
    serialize(color: ColorValue): string {
        const space = SPACE_MAP[color.colorSpace] ?? ".sRGB";
        const [r, g, b] = color.components;
        const parts = [
            `${space}`,
            `red: ${this.#number(r)}`,
            `green: ${this.#number(g)}`,
            `blue: ${this.#number(b)}`,
        ];
        if (color.alpha < 1) {
            parts.push(`opacity: ${color.alpha}`);
        }
        return `SwiftUI.Color(${parts.join(", ")})`;
    }

    #number(component: ColorComponent | undefined): string {
        if (typeof component !== "number") return "0";
        return String(component);
    }
}
