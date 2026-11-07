import { linearizeSrgbChannel, type SrgbColor } from "#/core/audit/color/SrgbColor";

type Channels = [number, number, number];

/**
 * Measures how different two colors look, as the Euclidean distance between
 * them in Oklab (ΔEok).
 *
 * Oklab is perceptually uniform, so equal distances look about equally
 * different. Colors 0.02 apart are about as close as the eye can tell apart;
 * black and white are 1 apart. Alpha is not taken into account.
 */
export function colorDistance(first: SrgbColor, second: SrgbColor): number {
    const [l1, a1, b1] = toOklab(first);
    const [l2, a2, b2] = toOklab(second);
    return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// Linear sRGB to Oklab, from https://bottosson.github.io/posts/oklab/
function toOklab(color: SrgbColor): Channels {
    const red = linearizeSrgbChannel(color.red);
    const green = linearizeSrgbChannel(color.green);
    const blue = linearizeSrgbChannel(color.blue);

    const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
    const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
    const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}
