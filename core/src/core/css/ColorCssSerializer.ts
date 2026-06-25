import { ColorValue, type ColorComponent, type ColorSpace } from "#/core/model/values/ColorValue";

type ColorSerializer = (color: ColorValue) => string;

/**
 * Serializes DTCG color values to CSS color syntax.
 */
export class ColorCssSerializer {
    readonly #serializers: Record<ColorSpace, ColorSerializer> = {
        "srgb": (color) => this.#colorFunction(color),
        "srgb-linear": (color) => this.#colorFunction(color),
        "display-p3": (color) => this.#colorFunction(color),
        "a98-rgb": (color) => this.#colorFunction(color),
        "prophoto-rgb": (color) => this.#colorFunction(color),
        "rec2020": (color) => this.#colorFunction(color),
        "xyz-d65": (color) => this.#colorFunction(color),
        "xyz-d50": (color) => this.#colorFunction(color),
        "hsl": (color) => `hsl(${this.#component(color.components[0])} ${this.#component(color.components[1], "%")} ${this.#component(color.components[2], "%")}${this.#alpha(color)})`,
        "hwb": (color) => `hwb(${this.#component(color.components[0])} ${this.#component(color.components[1], "%")} ${this.#component(color.components[2], "%")}${this.#alpha(color)})`,
        "lab": (color) => `lab(${this.#component(color.components[0], "%")} ${this.#component(color.components[1])} ${this.#component(color.components[2])}${this.#alpha(color)})`,
        "lch": (color) => `lch(${this.#component(color.components[0], "%")} ${this.#component(color.components[1])} ${this.#component(color.components[2])}${this.#alpha(color)})`,
        "oklab": (color) => `oklab(${this.#component(color.components[0])} ${this.#component(color.components[1])} ${this.#component(color.components[2])}${this.#alpha(color)})`,
        "oklch": (color) => `oklch(${this.#component(color.components[0])} ${this.#component(color.components[1])} ${this.#component(color.components[2])}${this.#alpha(color)})`,
    };

    serialize(color: ColorValue): string {
        if (color.hex && color.alpha === 1) return color.hex;
        return this.#serializers[color.colorSpace](color);
    }

    #colorFunction(color: ColorValue): string {
        const components = color.components.map((component) => this.#component(component)).join(" ");
        return `color(${color.colorSpace} ${components}${this.#alpha(color)})`;
    }

    #component(component: ColorComponent | undefined, unit = ""): string {
        if (component === "none") return component;
        return `${component ?? "none"}${unit}`;
    }

    #alpha(color: ColorValue, separator = " / "): string {
        return color.alpha === 1 ? "" : `${separator}${color.alpha}`;
    }
}
