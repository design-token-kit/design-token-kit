import { TokenEntry } from "#/core/showcase/CssTokenParser";

export type TypographyTokenInfo = {
    family?: string;
    size?: string;
    weight?: string;
    lineHeight?: string;
    letterSpacing?: string;
};

export type FontCollection = {
    key: string;
    title: string;
    entries: TokenEntry[];
};

export type BorderTokenInfo = {
    name: string;
    value?: string;
    color?: string;
    width?: string;
    style?: string;
};

export type BorderWidthTokenInfo = {
    name: string;
    value: string;
};

export type StrokeStyleTokenInfo = {
    name: string;
    value?: string;
    dashArray: string[];
    lineCap?: string;
};

export type ShadowLayerInfo = {
    offsetX?: string;
    offsetY?: string;
    blur?: string;
    spread?: string;
    color?: string;
};

export type ShadowTokenInfo = {
    name: string;
    value?: string;
    layers: ShadowLayerInfo[];
};

export type GradientStopInfo = {
    color?: string;
    position?: string;
};

export type GradientTokenInfo = {
    name: string;
    value?: string;
    stops: GradientStopInfo[];
};

export type TransitionTokenInfo = {
    name: string;
    value?: string;
    duration?: string;
    delay?: string;
    timingFunction: string[];
};

export type AggregatedTypographyToken = {
    name: string;
    value: string;
    typography?: TypographyTokenInfo;
};

export type AggregatedBorderTokens = {
    borders: BorderTokenInfo[];
    borderWidths: BorderWidthTokenInfo[];
    strokeStyles: StrokeStyleTokenInfo[];
    fallback: TokenEntry[];
};

/**
 * Groups typography tokens into models for the HTML showcase.
 *
 * @remarks
 * Combines separate CSS variables of one text style:
 * font size, font weight, line height, letter spacing and font family.
 *
 * The result is used by the renderer to show one typography card
 * instead of many separate CSS variables.
 */
export class TypographyTokenAggregator {
    aggregate(tokens: TokenEntry[]): AggregatedTypographyToken[] {
        const groups = new Map<string, { name: string; typography: TypographyTokenInfo }>();
        const result: AggregatedTypographyToken[] = [];

        for (const token of tokens) {
            const aggregateKey = this.getTypographyAggregateKey(token.name);
            if (!aggregateKey) {
                result.push({ name: token.name, value: token.value });
                continue;
            }

            let group = groups.get(aggregateKey.key);
            if (!group) {
                group = {
                    name: aggregateKey.key,
                    typography: {},
                };
                groups.set(aggregateKey.key, group);
            }

            this.assignTypographyProperty(group.typography, aggregateKey.property, token.value);
        }

        for (const group of groups.values()) {
            result.push({
                name: `--${group.name}`,
                value: this.formatTypographyValue(group.typography),
                typography: group.typography,
            });
        }

        return result.sort((left, right) => left.name.localeCompare(right.name));
    }

    private getTypographyAggregateKey(name: string): { key: string; property: string } | null {
        const normalized = name.replace(/^--/, "");
        const patterns = [
            /^(.*)-fontSize$/,
            /^(.*)-fontWeight$/,
            /^(.*)-letterSpacing$/,
            /^(.*)-lineHeight$/,
            /^(.*)-fontFamily-\d+$/,
        ];

        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (!match) {
                continue;
            }

            const property = normalized.slice(match[1].length + 1);
            return { key: match[1], property };
        }

        return null;
    }

    private assignTypographyProperty(info: TypographyTokenInfo, property: string, value: string): void {
        if (property === "fontSize") {
            info.size = value;
            return;
        }

        if (property === "fontWeight") {
            info.weight = value;
            return;
        }

        if (property === "letterSpacing") {
            info.letterSpacing = value;
            return;
        }

        if (property === "lineHeight") {
            info.lineHeight = value;
            return;
        }

        if (property.startsWith("fontFamily-")) {
            info.family = info.family ? `${info.family}, ${value}` : value;
        }
    }

    private formatTypographyValue(info: TypographyTokenInfo): string {
        const parts: string[] = [];
        if (info.weight) {
            parts.push(info.weight);
        }
        if (info.size) {
            parts.push(info.lineHeight ? `${info.size}/${info.lineHeight}` : info.size);
        }
        if (info.family) {
            parts.push(info.family);
        }
        if (parts.length === 0) {
            return "";
        }
        if (info.letterSpacing) {
            return `${parts.join(" ")}; letter-spacing ${info.letterSpacing}`;
        }
        return parts.join(" ");
    }
}

/**
 * Groups font tokens into collections for the HTML showcase.
 *
 * @remarks
 * Sorts font family, font weight, font size, line height
 * and letter spacing into separate sections with a fixed order.
 */
export class FontCollectionAggregator {
    aggregate(tokens: TokenEntry[]): FontCollection[] {
        const titles = new Map<string, string>([
            ["font-family", "font family"],
            ["font-weight", "font weight"],
            ["font-size", "font size"],
            ["line-height", "line height"],
            ["letter-spacing", "letter spacing"],
        ]);
        const order = ["font-family", "font-weight", "font-size", "line-height", "letter-spacing", "other"];
        const grouped = new Map<string, TokenEntry[]>();
        const fallback: TokenEntry[] = [];

        for (const token of tokens) {
            const key = this.getFontCollectionKey(token.name);
            if (!key) {
                fallback.push(token);
                continue;
            }

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(token);
        }

        if (fallback.length > 0) {
            grouped.set("other", fallback);
        }

        const result: FontCollection[] = [];
        for (const key of order) {
            const entries = grouped.get(key);
            if (!entries || entries.length === 0) {
                continue;
            }
            result.push({
                key,
                title: titles.get(key) ?? key,
                entries: [...entries].sort((left, right) => left.name.localeCompare(right.name)),
            });
        }

        return result;
    }

    private getFontCollectionKey(name: string): string | null {
        const normalized = name.replace(/^--/, "").toLowerCase();
        const patterns = [
            "font-family",
            "font-weight",
            "font-size",
            "line-height",
            "letter-spacing",
        ];

        for (const pattern of patterns) {
            if (normalized.includes(pattern)) {
                return pattern;
            }
        }

        return null;
    }
}

/**
 * Groups border tokens into models for the HTML showcase.
 *
 * @remarks
 * Combines full border tokens and their parts: color, width and style.
 * Separates border-width and stroke-style tokens, and returns
 * unsupported values as fallback.
 */
export class BorderTokenAggregator {
    aggregate(tokens: TokenEntry[]): AggregatedBorderTokens {
        const aggregated = this.aggregateBorderTokens(tokens);
        const strokeStyles = this.aggregateStrokeStyleTokens(aggregated.fallback);
        const strokeStyleNames = new Set(strokeStyles.flatMap((item) => this.getStrokeStyleTokenNames(item)));
        const borderWidths = aggregated.fallback
            .map((token) => this.toBorderWidthTokenInfo(token))
            .filter((token): token is BorderWidthTokenInfo => token !== null);
        const borderWidthNames = new Set(borderWidths.map((token) => this.normalizeTokenName(token.name)));
        const fallback = aggregated.fallback.filter((token) => (
            !strokeStyleNames.has(token.name)
            && !borderWidthNames.has(this.normalizeTokenName(token.name))
        ));

        return {
            borders: aggregated.items,
            borderWidths,
            strokeStyles,
            fallback,
        };
    }

    private aggregateBorderTokens(tokens: TokenEntry[]): { items: BorderTokenInfo[]; fallback: TokenEntry[] } {
        const map = new Map<string, BorderTokenInfo>();
        const consumed = new Set<string>();

        for (const token of tokens) {
            const parsed = this.parseBorderTokenName(token.name);
            if (!parsed) {
                continue;
            }

            const item = map.get(parsed.baseName) ?? { name: parsed.baseName };
            if (parsed.property === "value") {
                item.value = token.value;
            } else {
                item[parsed.property] = token.value;
            }
            map.set(parsed.baseName, item);
            consumed.add(token.name);
        }

        const items = [...map.values()]
            .filter((item) => item.value && (item.color || item.width || item.style))
            .sort((left, right) => left.name.localeCompare(right.name));
        const usedNames = new Set<string>();

        for (const item of items) {
            usedNames.add(`--${item.name}`);
            usedNames.add(`--${item.name}-color`);
            usedNames.add(`--${item.name}-width`);
            usedNames.add(`--${item.name}-style`);
        }

        const fallback = tokens.filter((token) => !consumed.has(token.name) || !usedNames.has(token.name));
        return { items, fallback };
    }

    private parseBorderTokenName(name: string): { baseName: string; property: "value" | "color" | "width" | "style" } | null {
        const normalized = name.replace(/^--/, "");
        const propertyMatch = normalized.match(/^(.*-border-.+)-(color|width|style)$/);
        if (propertyMatch) {
            return {
                baseName: propertyMatch[1],
                property: propertyMatch[2] as "color" | "width" | "style",
            };
        }

        if (/.*-border-.+/.test(normalized) && !normalized.includes("-border-width-")) {
            return { baseName: normalized, property: "value" };
        }

        return null;
    }

    private toBorderWidthTokenInfo(token: TokenEntry): BorderWidthTokenInfo | null {
        const normalized = token.name.replace(/^--/, "");
        if (!/-border-width-/.test(normalized)) {
            return null;
        }
        return {
            name: normalized,
            value: token.value,
        };
    }

    private aggregateStrokeStyleTokens(tokens: TokenEntry[]): StrokeStyleTokenInfo[] {
        const map = new Map<string, StrokeStyleTokenInfo>();

        for (const token of tokens) {
            const parsed = this.parseStrokeStyleTokenName(token.name);
            if (!parsed) {
                continue;
            }

            const item = map.get(parsed.baseName) ?? {
                name: parsed.baseName,
                dashArray: [],
            };

            if (parsed.property === "value") {
                item.value = token.value;
            } else if (parsed.property === "lineCap") {
                item.lineCap = token.value;
            } else {
                item.dashArray[parsed.index ?? item.dashArray.length] = token.value;
            }

            map.set(parsed.baseName, item);
        }

        return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
    }

    private parseStrokeStyleTokenName(
        name: string,
    ): { baseName: string; property: "value" | "dashArray" | "lineCap"; index?: number } | null {
        const normalized = name.replace(/^--/, "");
        const dashArrayMatch = normalized.match(/^(.*-stroke-style-.+)-dashArray-(\d+)$/);
        if (dashArrayMatch) {
            return {
                baseName: dashArrayMatch[1],
                property: "dashArray",
                index: Number(dashArrayMatch[2]),
            };
        }

        const lineCapMatch = normalized.match(/^(.*-stroke-style-.+)-lineCap$/);
        if (lineCapMatch) {
            return {
                baseName: lineCapMatch[1],
                property: "lineCap",
            };
        }

        if (/.*-stroke-style-.+/.test(normalized)) {
            return {
                baseName: normalized,
                property: "value",
            };
        }

        return null;
    }

    private getStrokeStyleTokenNames(item: StrokeStyleTokenInfo): string[] {
        const names = [`--${item.name}`];
        if (item.lineCap !== undefined) {
            names.push(`--${item.name}-lineCap`);
        }
        item.dashArray.forEach((_value, index) => {
            names.push(`--${item.name}-dashArray-${index}`);
        });
        return names;
    }

    private normalizeTokenName(name: string): string {
        return name.replace(/^--/, "");
    }
}

/**
 * Groups shadow tokens into models for the HTML showcase.
 *
 * @remarks
 * Combines single-layer and multi-layer shadows from separate CSS variables:
 * offsetX, offsetY, blur, spread and color.
 *
 * Returns unsupported or incomplete values as fallback.
 */
export class ShadowTokenAggregator {
    aggregate(tokens: TokenEntry[]): { items: ShadowTokenInfo[]; fallback: TokenEntry[] } {
        const map = new Map<string, ShadowTokenInfo>();
        const consumed = new Set<string>();

        for (const token of tokens) {
            const parsed = this.parseShadowTokenName(token.name);
            if (!parsed) {
                continue;
            }

            const item = map.get(parsed.baseName) ?? { name: parsed.baseName, layers: [] };
            if (parsed.property === "value") {
                item.value = token.value;
            } else {
                const layer = item.layers[parsed.layerIndex] ?? {};
                layer[parsed.property] = token.value;
                item.layers[parsed.layerIndex] = layer;
            }

            map.set(parsed.baseName, item);
            consumed.add(token.name);
        }

        const items = [...map.values()]
            .map((item) => ({ ...item, layers: item.layers.filter((layer) => layer !== undefined) }))
            .filter((item) => item.value && item.layers.length > 0)
            .sort((left, right) => left.name.localeCompare(right.name));
        const usedNames = new Set<string>();

        for (const item of items) {
            usedNames.add(`--${item.name}`);
            item.layers.forEach((_layer, index) => {
                const layerPrefix = item.layers.length > 1 ? `${item.name}-${index}` : item.name;
                usedNames.add(`--${layerPrefix}-offsetX`);
                usedNames.add(`--${layerPrefix}-offsetY`);
                usedNames.add(`--${layerPrefix}-blur`);
                usedNames.add(`--${layerPrefix}-spread`);
                usedNames.add(`--${layerPrefix}-color`);
            });
        }

        const fallback = tokens.filter((token) => !consumed.has(token.name) || !usedNames.has(token.name));
        return { items, fallback };
    }

    private parseShadowTokenName(
        name: string,
    ): { baseName: string; property: "value" | keyof ShadowLayerInfo; layerIndex: number } | null {
        const normalized = name.replace(/^--/, "");
        const layerMatch = normalized.match(/^(.*-shadow-.+)-(\d+)-(offsetX|offsetY|blur|spread|color)$/);
        if (layerMatch) {
            return {
                baseName: layerMatch[1],
                property: layerMatch[3] as keyof ShadowLayerInfo,
                layerIndex: Number(layerMatch[2]),
            };
        }

        const propertyMatch = normalized.match(/^(.*-shadow-.+)-(offsetX|offsetY|blur|spread|color)$/);
        if (propertyMatch) {
            return {
                baseName: propertyMatch[1],
                property: propertyMatch[2] as keyof ShadowLayerInfo,
                layerIndex: 0,
            };
        }

        if (/.*-shadow-.+/.test(normalized)) {
            return {
                baseName: normalized,
                property: "value",
                layerIndex: 0,
            };
        }

        return null;
    }
}

/**
 * Groups gradient tokens into models for the HTML showcase.
 *
 * @remarks
 * Combines gradient stop parts: color and position.
 * The result is used by the renderer to build preview via CSS gradient.
 *
 * Returns unsupported or incomplete values as fallback.
 */
export class GradientTokenAggregator {
    aggregate(tokens: TokenEntry[]): { items: GradientTokenInfo[]; fallback: TokenEntry[] } {
        const map = new Map<string, GradientTokenInfo>();
        const consumed = new Set<string>();

        for (const token of tokens) {
            const parsed = this.parseGradientTokenName(token.name);
            if (!parsed) {
                continue;
            }

            const item = map.get(parsed.baseName) ?? { name: parsed.baseName, stops: [] };
            if (parsed.property === "value") {
                item.value = token.value;
            } else {
                const stop = item.stops[parsed.stopIndex] ?? {};
                stop[parsed.property] = token.value;
                item.stops[parsed.stopIndex] = stop;
            }

            map.set(parsed.baseName, item);
            consumed.add(token.name);
        }

        const items = [...map.values()]
            .map((item) => ({ ...item, stops: item.stops.filter((stop) => stop?.color) }))
            .filter((item) => item.stops.length > 0)
            .sort((left, right) => left.name.localeCompare(right.name));
        const usedNames = new Set<string>();

        for (const item of items) {
            item.stops.forEach((_stop, index) => {
                usedNames.add(`--${item.name}-${index}-color`);
                usedNames.add(`--${item.name}-${index}-position`);
            });
        }

        const fallback = tokens.filter((token) => !consumed.has(token.name) || !usedNames.has(token.name));
        return { items, fallback };
    }

    private parseGradientTokenName(
        name: string,
    ): { baseName: string; property: "value" | keyof GradientStopInfo; stopIndex: number } | null {
        const normalized = name.replace(/^--/, "");
        const stopMatch = normalized.match(/^(.*-gradient-.+)-(\d+)-(color|position)$/);
        if (stopMatch) {
            return {
                baseName: stopMatch[1],
                property: stopMatch[3] as keyof GradientStopInfo,
                stopIndex: Number(stopMatch[2]),
            };
        }

        if (/.*-gradient-.+/.test(normalized)) {
            return {
                baseName: normalized,
                property: "value",
                stopIndex: 0,
            };
        }

        return null;
    }
}

/**
 * Groups transition tokens into models for the HTML showcase.
 *
 * @remarks
 * Combines duration, delay and timingFunction parts of one transition.
 * The result is used by the renderer to show motion cards.
 *
 * Returns unsupported values as fallback.
 */
export class TransitionTokenAggregator {
    aggregate(tokens: TokenEntry[]): { items: TransitionTokenInfo[]; fallback: TokenEntry[] } {
        const map = new Map<string, TransitionTokenInfo>();
        const consumed = new Set<string>();

        for (const token of tokens) {
            const parsed = this.parseTransitionTokenName(token.name);
            if (!parsed) {
                continue;
            }

            const item = map.get(parsed.baseName) ?? { name: parsed.baseName, timingFunction: [] };
            if (parsed.property === "value") {
                item.value = token.value;
            } else if (parsed.property === "timingFunction") {
                item.timingFunction[parsed.index ?? item.timingFunction.length] = token.value;
            } else {
                item[parsed.property] = token.value;
            }

            map.set(parsed.baseName, item);
            consumed.add(token.name);
        }

        const items = [...map.values()]
            .filter((item) => item.value || item.duration || item.timingFunction.length > 0 || item.delay)
            .sort((left, right) => left.name.localeCompare(right.name));
        const usedNames = new Set<string>();

        for (const item of items) {
            usedNames.add(`--${item.name}`);
            usedNames.add(`--${item.name}-duration`);
            usedNames.add(`--${item.name}-delay`);
            item.timingFunction.forEach((_value, index) => {
                usedNames.add(`--${item.name}-timingFunction-${index}`);
            });
        }

        const fallback = tokens.filter((token) => !consumed.has(token.name) || !usedNames.has(token.name));
        return { items, fallback };
    }

    private parseTransitionTokenName(
        name: string,
    ): { baseName: string; property: "value" | "duration" | "delay" | "timingFunction"; index?: number } | null {
        const normalized = name.replace(/^--/, "");
        const timingMatch = normalized.match(/^(.*-transition-.+)-timingFunction-(\d+)$/);
        if (timingMatch) {
            return {
                baseName: timingMatch[1],
                property: "timingFunction",
                index: Number(timingMatch[2]),
            };
        }

        const propertyMatch = normalized.match(/^(.*-transition-.+)-(duration|delay)$/);
        if (propertyMatch) {
            return {
                baseName: propertyMatch[1],
                property: propertyMatch[2] as "duration" | "delay",
            };
        }

        if (/.*-transition-.+/.test(normalized)) {
            return {
                baseName: normalized,
                property: "value",
            };
        }

        return null;
    }
}
