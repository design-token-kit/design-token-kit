import type { TextSample } from "#/core/audit/accessibility/TextSample";
import { toSrgbColor, type SrgbColor } from "#/core/audit/color/SrgbColor";
import { colorRole, normalizedPath, type ColorRole } from "#/core/audit/tokens/ColorRole";
import type { Dtcg } from "#/core/model/Dtcg";
import type { DtcgList } from "#/core/model/DtcgList";
import { materializePropertyReferences } from "#/core/model/PropertyReferenceMaterializer";
import { readRemBase } from "#/core/model/RemBaseExtension";
import { TokenNode } from "#/core/model/TokenNode";
import type { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorValue, isConcreteColorValue } from "#/core/model/values/ColorValue";
import { DEFAULT_REM_BASE, DimensionValue, isConcreteDimensionValue } from "#/core/model/values/DimensionValue";
import { FontWeightName } from "#/core/model/values/FontWeightName";
import { TypographyValue } from "#/core/model/values/TypographyValue";

/**
 * Builds the {@link TextSample}s a token set implies, for the accessibility
 * audit.
 *
 * Two kinds of samples are built:
 *
 * - a pair of a text color and a background color meant to be used together,
 *   inferred from token names (see {@link colorRole}). When the group holding
 *   the pair also holds a typography token, its font size and weight decide
 *   whether the pair is held to the large text contrast minimum;
 * - a typography token with its own value, for the font size and line height
 *   rules. Aliases are skipped: the token they point to is audited instead.
 *
 * The base set is sampled first, then every theme with the base as a
 * fallback. A theme sample identical to a base sample is dropped, so a theme
 * reports only what it changes.
 */
export class TokenTextSampler {

    /**
     * Builds the samples of a token set and its themes.
     */
    sample(list: DtcgList): TextSample[] {
        const materialized = materializePropertyReferences(list);
        const remBase = readRemBase(materialized.base.root) ?? DEFAULT_REM_BASE;
        const paths = collectTokenPaths(materialized);
        const contexts: SamplingContext[] = [
            { doc: materialized.base },
            ...Array.from(materialized.themes, ([theme, doc]) => ({ doc, fallback: materialized.base, theme })),
        ];

        const samples: TextSample[] = [];
        const seen = new Set<string>();
        for (const context of contexts) {
            for (const sample of new ContextSampler(context, remBase).sample(paths)) {
                const key = sampleKey(sample);
                if (seen.has(key)) continue;
                seen.add(key);
                samples.push(sample);
            }
        }
        return samples;
    }
}

interface SamplingContext {
    /** Document the tokens are resolved in. */
    readonly doc: Dtcg;

    /** Base document a theme falls back to. */
    readonly fallback?: Dtcg;

    /** Theme name; `undefined` for the base set. */
    readonly theme?: string;
}

interface ColorEntry {
    readonly path: TokenPath;
    readonly key: string;
    readonly role: ColorRole | undefined;
    readonly color?: SrgbColor;
    readonly problem?: string;
}

interface TypographyEntry {
    readonly path: TokenPath;
    readonly parentKey: string;
    readonly own: boolean;
    readonly fontSizePx?: number;
    readonly fontWeight?: number;
    readonly lineHeight?: number;
}

/**
 * Samples the tokens of one document: the base set or one theme over it.
 */
class ContextSampler {
    readonly #context: SamplingContext;
    readonly #remBase: number;

    constructor(context: SamplingContext, remBase: number) {
        this.#context = context;
        this.#remBase = remBase;
    }

    sample(paths: readonly TokenPath[]): TextSample[] {
        const colors: ColorEntry[] = [];
        const typographies: TypographyEntry[] = [];

        for (const path of paths) {
            const node = this.#resolveNode(path);
            if (node === undefined) continue;
            const value = this.#resolveValue(node.value);
            if (value instanceof ColorValue) {
                colors.push(this.#colorEntry(path, value));
            } else if (value instanceof TypographyValue) {
                typographies.push(this.#typographyEntry(path, value, !(node.value instanceof TokenReference)));
            }
        }

        return [
            ...this.#colorPairSamples(colors, typographies),
            ...typographies.filter((entry) => entry.own).map((entry) => this.#typographySample(entry)),
        ];
    }

    #colorEntry(path: TokenPath, value: ColorValue): ColorEntry {
        const color = toSrgbColor(value);
        return {
            path,
            key: normalizedPath(path),
            role: colorRole(path),
            color,
            problem: color === undefined ? describeUnreadableColor(value) : undefined,
        };
    }

    #typographyEntry(path: TokenPath, value: TypographyValue, own: boolean): TypographyEntry {
        const segments = path.segments();
        return {
            path,
            parentKey: normalizedPath(path).split(".").slice(0, segments.length - 1).join("."),
            own,
            fontSizePx: this.#fontSize(value.fontSize),
            fontWeight: this.#fontWeight(value.fontWeight),
            lineHeight: this.#number(value.lineHeight),
        };
    }

    #colorPairSamples(colors: ColorEntry[], typographies: TypographyEntry[]): TextSample[] {
        const byKey = new Map(colors.map((entry) => [entry.key, entry]));
        const targets = new Map(colors.map((entry) => [entry, firstDefined(entry.role?.targets?.map((key) => byKey.get(key)) ?? [])]));
        // A background with its own on-X text colour is meant for that colour only.
        const dedicated = new Set(Array.from(targets.values()).flat());
        const backgrounds = colors.filter((entry) => entry.role?.kind === "background" && !dedicated.has(entry));
        const samples: TextSample[] = [];

        for (const text of colors) {
            const role = text.role;
            if (role?.kind !== "foreground") continue;

            const partners = role.targets !== undefined
                ? targets.get(text) ?? []
                : backgrounds.filter((background) => background.role?.context === role.context
                    && background.role.inverse === role.inverse);
            for (const background of partners) {
                if (background.path.equals(text.path)) continue;
                samples.push(this.#pairSample(text, background, smallestTypography(typographies, role.context)));
            }
        }
        return samples;
    }

    #pairSample(text: ColorEntry, background: ColorEntry, typography: TypographyEntry | undefined): TextSample {
        const unreadable = text.problem !== undefined ? text : background.problem !== undefined ? background : undefined;
        return {
            id: `${text.path.toString()}|${background.path.toString()}`,
            label: `${text.path.toString()} on ${background.path.toString()}`,
            sourcePath: this.#context.doc.source,
            tokenPath: text.path,
            theme: this.#context.theme,
            foreground: text.color,
            background: background.color,
            colorProblem: unreadable === undefined ? undefined : `cannot read ${unreadable.path.toString()}: ${unreadable.problem}`,
            fontSizePx: typography?.fontSizePx,
            fontWeight: typography?.fontWeight,
        };
    }

    #typographySample(entry: TypographyEntry): TextSample {
        return {
            id: entry.path.toString(),
            label: entry.path.toString(),
            sourcePath: this.#context.doc.source,
            tokenPath: entry.path,
            theme: this.#context.theme,
            fontSizePx: entry.fontSizePx,
            fontWeight: entry.fontWeight,
            lineHeight: entry.lineHeight,
        };
    }

    #resolveNode(path: TokenPath): TokenNode<unknown> | undefined {
        const node = this.#context.doc.resolveRef(new TokenReference(path), this.#context.fallback)?.node;
        return node instanceof TokenNode ? node : undefined;
    }

    /**
     * Resolves a value that may be a reference, following alias chains to the
     * value they end at.
     */
    #resolveValue(value: unknown): unknown {
        if (!(value instanceof TokenReference)) return value;
        if (value.isPropertyReference) {
            return this.#context.doc.resolveReferenceValue(value, this.#context.fallback);
        }
        const end = this.#context.doc.resolveChain(value, this.#context.fallback);
        return end instanceof TokenNode && !(end.value instanceof TokenReference) ? end.value : undefined;
    }

    #fontSize(value: unknown): number | undefined {
        const size = this.#resolveValue(value);
        return size instanceof DimensionValue && isConcreteDimensionValue(size) ? size.toPixels(this.#remBase) : undefined;
    }

    #fontWeight(value: unknown): number | undefined {
        const weight = this.#resolveValue(value);
        if (weight instanceof FontWeightName) return weight.weight;
        return typeof weight === "number" && Number.isFinite(weight) ? weight : undefined;
    }

    #number(value: unknown): number | undefined {
        const number = this.#resolveValue(value);
        return typeof number === "number" && Number.isFinite(number) ? number : undefined;
    }
}

/**
 * Lists the token paths of the base set and of every theme, base first,
 * without duplicates.
 */
function collectTokenPaths(list: DtcgList): TokenPath[] {
    const paths = new Map<string, TokenPath>();
    for (const doc of [list.base, ...list.themes.values()]) {
        doc.walk((node, path) => {
            if (node instanceof TokenNode && !paths.has(path.toString())) {
                paths.set(path.toString(), path);
            }
        });
    }
    return Array.from(paths.values());
}

/**
 * Returns the typography token directly in a group with the smallest font size,
 * the strictest case for the contrast minimum.
 */
function smallestTypography(typographies: TypographyEntry[], context: string): TypographyEntry | undefined {
    return typographies
        .filter((entry) => entry.parentKey === context && entry.fontSizePx !== undefined)
        .sort((a, b) => a.fontSizePx! - b.fontSizePx!)[0];
}

function firstDefined<T>(values: Array<T | undefined>): T[] {
    const value = values.find((candidate) => candidate !== undefined);
    return value === undefined ? [] : [value];
}

function describeUnreadableColor(value: ColorValue): string {
    if (!isConcreteColorValue(value)) {
        return "the color holds an unresolved reference";
    }
    return `the ${value.colorSpace} color space is not supported without a hex fallback`;
}

function sampleKey(sample: TextSample): string {
    return JSON.stringify([
        sample.id,
        sample.foreground,
        sample.background,
        sample.colorProblem,
        sample.fontSizePx,
        sample.fontWeight,
        sample.lineHeight,
    ]);
}
