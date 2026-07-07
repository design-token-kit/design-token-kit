import { ColorValue, type ColorComponent, type ColorSpace } from "#/core/model/values/ColorValue";

type ColorSerializer = (color: ColorValue) => string;
type ColorSerializerMode = "css" | "tailwind";

export interface ColorCssSerializerOptions {
    mode?: ColorSerializerMode;
}

/**
 * Serializes DTCG color values to CSS color syntax.
 */
export class ColorCssSerializer {
    readonly #mode: ColorSerializerMode;

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

    constructor(options: ColorCssSerializerOptions = {}) {
        this.#mode = options.mode ?? "css";
    }

    serialize(color: ColorValue): string {
        if (this.#mode === "tailwind") {
            const tailwindColor = this.#serializeTailwind(color);
            if (tailwindColor) return tailwindColor;
        }
        if (color.hex && color.alpha === 1) return color.hex;
        return this.#serializers[color.colorSpace](color);
    }

    #serializeTailwind(color: ColorValue): string | undefined {
        if (color.colorSpace !== "srgb") {
            return undefined;
        }

        if (color.alpha === 1) {
            return color.hex ?? this.#tryHexFromSrgb(color.components);
        }

        const rgbComponents = this.#toSrgb255Components(color.components);
        if (!rgbComponents) return undefined;
        return `rgb(${rgbComponents.join(" ")} / ${color.alpha})`;
    }

    #colorFunction(color: ColorValue): string {
        const components = color.components.map((component) => this.#component(component)).join(" ");
        return `color(${color.colorSpace} ${components}${this.#alpha(color)})`;
    }

    #tryHexFromSrgb(components: ColorComponent[]): string | undefined {
        const rgbComponents = this.#toSrgb255Components(components);
        if (!rgbComponents) return undefined;
        return `#${rgbComponents.map((component) => component.toString(16).padStart(2, "0")).join("")}`;
    }

    #toSrgb255Components(components: ColorComponent[]): number[] | undefined {
        const rgbComponents: number[] = [];
        for (const component of components.slice(0, 3)) {
            if (typeof component !== "number") return undefined;
            if (component < 0 || component > 1) return undefined;
            rgbComponents.push(Math.round(component * 255));
        }
        return rgbComponents.length === 3 ? rgbComponents : undefined;
    }

    #component(component: ColorComponent | undefined, unit = ""): string {
        if (component === "none") return component;
        return `${component ?? "none"}${unit}`;
    }

    #alpha(color: ColorValue, separator = " / "): string {
        return color.alpha === 1 ? "" : `${separator}${color.alpha}`;
    }
}
