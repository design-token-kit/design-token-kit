import { ColorValue, type ColorComponent } from "#/core/model/values/ColorValue";

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;
const CHANNEL_MAX = 255;
const OPAQUE = "ff";

/**
 * Converts DTCG color values to the Android `#AARRGGBB` hex form.
 *
 * @remarks
 * Android resource files require the alpha channel first. Components of
 * RGB-based color spaces are read as 0-1 channel values; other color spaces
 * (lab, lch, oklab, oklch, hsl, ...) have no in-model conversion, so their
 * 6-digit `hex` fallback is used when present and opaque black otherwise.
 */
export class AndroidColorValueConverter {
    convert(color: ColorValue): string {
        return `#${this.#alpha(color.alpha)}${this.#rgb(color)}`;
    }

    #rgb(color: ColorValue): string {
        return this.#fromComponents(color.components)
            ?? this.#fromHex(color.hex)
            ?? "000000";
    }

    #fromComponents(components: ColorComponent[]): string | undefined {
        const channels = components.slice(0, 3);
        if (channels.length < 3) return undefined;
        if (!channels.every((channel) => typeof channel === "number")) return undefined;
        return channels.map((channel) => this.#channel(channel)).join("");
    }

    #fromHex(hex: string | undefined): string | undefined {
        const match = hex?.match(HEX_PATTERN);
        return match ? match[1].toLowerCase() : undefined;
    }

    #channel(value: number): string {
        return this.#byte(Math.round(this.#clamp(value) * CHANNEL_MAX));
    }

    #alpha(value: number): string {
        if (!Number.isFinite(value)) return OPAQUE;
        return this.#byte(Math.round(this.#clamp(value) * CHANNEL_MAX));
    }

    #clamp(value: number): number {
        return Math.min(1, Math.max(0, value));
    }

    #byte(value: number): string {
        return value.toString(16).padStart(2, "0");
    }
}
