/** Names of the color representations available in the showcase. */
export type ColorFormatName = "css" | "hex" | "rgb" | "hsl";

/** A color representation shown by the format selector. */
export type ColorFormatValue = {
    name: ColorFormatName;
    label: string;
    value: string;
};

type RgbaColor = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

const COLOR_FORMAT_LABELS: Record<ColorFormatName, string> = {
    css: "CSS",
    hex: "HEX",
    rgb: "RGBA",
    hsl: "HSLA",
};

/**
 * Converts CSS colors into copyable common color representations.
 *
 * The original CSS value is always returned. Other representations are added
 * only when the color can be converted without losing its color space.
 */
export class ColorFormatConverter {
    convert(cssColor: string): ColorFormatValue[] {
        const normalizedColor = cssColor.trim();
        const formats: ColorFormatValue[] = [this.createFormat("css", normalizedColor)];
        const rgba = this.parseRgba(normalizedColor);

        if (rgba === undefined) {
            return formats;
        }

        formats.push(
            this.createFormat("hex", this.toHex(rgba)),
            this.createFormat("rgb", this.toRgb(rgba)),
            this.createFormat("hsl", this.toHsl(rgba)),
        );
        return formats;
    }

    private createFormat(name: ColorFormatName, value: string): ColorFormatValue {
        return { name, label: COLOR_FORMAT_LABELS[name], value };
    }

    private parseRgba(value: string): RgbaColor | undefined {
        if (value.toLowerCase() === "transparent") {
            return { red: 0, green: 0, blue: 0, alpha: 0 };
        }

        const hex = this.parseHex(value);
        if (hex !== undefined) {
            return hex;
        }

        const functionMatch = value.match(/^([a-z-]+)\((.*)\)$/i);
        if (!functionMatch) {
            return undefined;
        }

        const functionName = functionMatch[1].toLowerCase();
        if (functionName === "rgb" || functionName === "rgba") {
            return this.parseRgb(functionMatch[2]);
        }
        if (functionName === "hsl" || functionName === "hsla") {
            return this.parseHsl(functionMatch[2]);
        }
        if (functionName === "color") {
            return this.parseSrgbColor(functionMatch[2]);
        }

        return undefined;
    }

    private parseHex(value: string): RgbaColor | undefined {
        const match = value.match(/^#([0-9a-f]{3,8})$/i);
        if (!match || ![3, 4, 6, 8].includes(match[1].length)) {
            return undefined;
        }

        const digits = match[1].length <= 4
            ? [...match[1]].map((digit) => digit + digit).join("")
            : match[1];
        return {
            red: Number.parseInt(digits.slice(0, 2), 16),
            green: Number.parseInt(digits.slice(2, 4), 16),
            blue: Number.parseInt(digits.slice(4, 6), 16),
            alpha: digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
        };
    }

    private parseRgb(value: string): RgbaColor | undefined {
        const parts = this.splitComponents(value);
        if (parts.length !== 3 && parts.length !== 4) {
            return undefined;
        }

        const channels = parts.slice(0, 3).map((part) => this.parseRgbChannel(part));
        const alpha = this.parseAlpha(parts[3] ?? "1");
        if (channels.some((channel) => channel === undefined) || alpha === undefined) {
            return undefined;
        }

        return {
            red: channels[0]!,
            green: channels[1]!,
            blue: channels[2]!,
            alpha,
        };
    }

    private parseHsl(value: string): RgbaColor | undefined {
        const parts = this.splitComponents(value);
        if (parts.length !== 3 && parts.length !== 4) {
            return undefined;
        }

        const hue = this.parseHue(parts[0]);
        const saturation = this.parsePercentage(parts[1]);
        const lightness = this.parsePercentage(parts[2]);
        const alpha = this.parseAlpha(parts[3] ?? "1");
        if (
            hue === undefined
            || saturation === undefined
            || lightness === undefined
            || alpha === undefined
        ) {
            return undefined;
        }

        return { ...this.hslToRgb(hue, saturation, lightness), alpha };
    }

    private parseSrgbColor(value: string): RgbaColor | undefined {
        const parts = this.splitComponents(value);
        if (
            parts[0]?.toLowerCase() !== "srgb"
            || (parts.length !== 4 && parts.length !== 5)
        ) {
            return undefined;
        }

        const channels = parts.slice(1, 4).map((part) => this.parseUnitInterval(part));
        const alpha = this.parseAlpha(parts[4] ?? "1");
        if (channels.some((channel) => channel === undefined) || alpha === undefined) {
            return undefined;
        }

        return {
            red: channels[0]! * 255,
            green: channels[1]! * 255,
            blue: channels[2]! * 255,
            alpha,
        };
    }

    private splitComponents(value: string): string[] {
        return value
            .trim()
            .replace(/\s*\/\s*/g, " ")
            .split(/[\s,]+/)
            .filter((part) => part !== "/");
    }

    private parseRgbChannel(value: string): number | undefined {
        if (value.endsWith("%")) {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? this.clamp(parsed * 255 / 100, 0, 255) : undefined;
        }
        return this.parseNumber(value, 0, 255);
    }

    private parseAlpha(value: string): number | undefined {
        if (value.endsWith("%")) {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) ? this.clamp(parsed / 100, 0, 1) : undefined;
        }
        return this.parseNumber(value, 0, 1);
    }

    private parsePercentage(value: string): number | undefined {
        const numeric = value.endsWith("%") ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
        return Number.isFinite(numeric) ? this.clamp(numeric, 0, 1) : undefined;
    }

    private parseUnitInterval(value: string): number | undefined {
        const numeric = value.endsWith("%") ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
        return Number.isFinite(numeric) ? this.clamp(numeric, 0, 1) : undefined;
    }

    private parseHue(value: string): number | undefined {
        const match = value.match(/^(-?(?:\d+\.?\d*|\.\d+))(deg|grad|rad|turn)?$/i);
        if (!match) {
            return undefined;
        }

        const amount = Number.parseFloat(match[1]);
        const unit = match[2]?.toLowerCase();
        const degrees = unit === "grad"
            ? amount * 0.9
            : unit === "rad"
                ? amount * (180 / Math.PI)
                : unit === "turn"
                    ? amount * 360
                    : amount;
        return ((degrees % 360) + 360) % 360;
    }

    private parseNumber(value: string, minimum: number, maximum: number): number | undefined {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? this.clamp(parsed, minimum, maximum) : undefined;
    }

    private hslToRgb(hue: number, saturation: number, lightness: number): Omit<RgbaColor, "alpha"> {
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const segment = hue / 60;
        const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
        const match = lightness - chroma / 2;
        const [red, green, blue] = segment < 1
            ? [chroma, intermediate, 0]
            : segment < 2
                ? [intermediate, chroma, 0]
                : segment < 3
                    ? [0, chroma, intermediate]
                    : segment < 4
                        ? [0, intermediate, chroma]
                        : segment < 5
                            ? [intermediate, 0, chroma]
                            : [chroma, 0, intermediate];
        return { red: (red + match) * 255, green: (green + match) * 255, blue: (blue + match) * 255 };
    }

    private toHex(color: RgbaColor): string {
        const channels = [color.red, color.green, color.blue]
            .map((channel) => Math.round(channel).toString(16).padStart(2, "0"));
        const alpha = color.alpha < 1 ? Math.round(color.alpha * 255).toString(16).padStart(2, "0") : "";
        return `#${channels.join("")}${alpha}`;
    }

    private toRgb(color: RgbaColor): string {
        const channels = [color.red, color.green, color.blue].map((channel) => String(Math.round(channel)));
        return `rgba(${channels.join(", ")}, ${this.formatNumber(color.alpha)})`;
    }

    private toHsl(color: RgbaColor): string {
        const red = color.red / 255;
        const green = color.green / 255;
        const blue = color.blue / 255;
        const maximum = Math.max(red, green, blue);
        const minimum = Math.min(red, green, blue);
        const lightness = (maximum + minimum) / 2;
        const difference = maximum - minimum;
        let hue = 0;
        let saturation = 0;

        if (difference !== 0) {
            saturation = difference / (1 - Math.abs(2 * lightness - 1));
            hue = maximum === red
                ? 60 * (((green - blue) / difference) % 6)
                : maximum === green
                    ? 60 * ((blue - red) / difference + 2)
                    : 60 * ((red - green) / difference + 4);
        }

        const hsl = `${this.formatNumber((hue + 360) % 360)}, `
            + `${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%`;
        return `hsla(${hsl}, ${this.formatNumber(color.alpha)})`;
    }

    private formatNumber(value: number): string {
        return Number(value.toFixed(4)).toString();
    }

    private clamp(value: number, minimum: number, maximum: number): number {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
