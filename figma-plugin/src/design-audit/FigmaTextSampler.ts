import type { TextSample } from "@design-token-kit/core/core/audit/accessibility/TextSample";
import type { SrgbColor } from "@design-token-kit/core/core/audit/color/SrgbColor";
import { compositeOver } from "@design-token-kit/core/core/audit/color/Wcag";

const WHITE: SrgbColor = { red: 1, green: 1, blue: 1, alpha: 1 };

/**
 * Builds {@link TextSample}s from Figma text nodes, for the accessibility audit.
 *
 * The text colour is the node's own fill. The background is found by looking
 * straight down through the layers under the centre of the text: siblings
 * painted below it, then the fills of each parent, then the page background.
 * Translucent layers are blended until an opaque one is reached.
 *
 * Text whose colour or background is a gradient, an image or a mix of fills
 * cannot be measured; its sample carries the reason instead of the colour.
 *
 * Only text a reader sees is sampled: hidden, empty and unfilled layers are
 * left out, and so are layers that use text as a shape - masks, layers inside
 * a boolean operation, and icon font glyphs.
 */
export class FigmaTextSampler {

    /**
     * Samples the text nodes a reader sees.
     *
     * @param nodes - Text nodes, typically every text node of a page.
     * @param includePageInPath - Whether the node path starts with its page name,
     *   for audits that span several pages.
     */
    sample(nodes: readonly TextNode[], includePageInPath = false): SampledTextNode[] {
        return nodes
            .filter((node) => isReadableText(node) && isRendered(node) && hasVisibleFill(node))
            .map((node) => this.#sampleNode(node, includePageInPath));
    }

    #sampleNode(node: TextNode, includePageInPath: boolean): SampledTextNode {
        const foreground = readTextColor(node);
        const background = typeof foreground === "string" ? undefined : readBackground(node);
        const problem = typeof foreground === "string" ? foreground
            : typeof background === "string" ? background
            : undefined;
        const fontSizePx = readFontSize(node);

        return {
            sample: {
                id: node.id,
                label: node.name,
                foreground: typeof foreground === "string" ? undefined : foreground,
                background: typeof background === "string" ? undefined : background,
                colorProblem: problem === undefined ? undefined : PROBLEM_MESSAGES[problem],
                fontSizePx,
                fontWeight: readFontWeight(node),
                lineHeight: readLineHeight(node, fontSizePx),
            },
            node: {
                id: node.id,
                name: node.name,
                path: nodePath(node, includePageInPath),
                problem,
            },
        };
    }
}

/**
 * A text node's audit sample and the details shown next to its findings.
 */
export interface SampledTextNode {
    readonly sample: TextSample;
    readonly node: AuditedNode;
}

/**
 * A Figma node as listed under a finding.
 */
export interface AuditedNode {
    readonly id: string;
    readonly name: string;

    /** Names of the containing frames and groups, outermost first, e.g. `Card / Product`. */
    readonly path: string;

    /** Why the contrast of the node cannot be measured, when it cannot. */
    readonly problem?: ColorProblem;
}

/**
 * Why the contrast of a text node cannot be measured.
 */
export type ColorProblem = "gradient" | "image" | "mixed";

const PROBLEM_MESSAGES: Record<ColorProblem, string> = {
    gradient: "the text or its background is a gradient, so the ratio cannot be calculated.",
    image: "the text sits on an image, so the ratio cannot be calculated.",
    mixed: "the text has several colours, so the ratio cannot be calculated for one.",
};

interface Point {
    readonly x: number;
    readonly y: number;
}

/** Outcome of looking down through one layer. */
type LayerOutcome = "opaque" | "continue" | ColorProblem;

// Private Use Area code points, where icon fonts place their glyphs.
const ICON_GLYPH = /[-\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;

/**
 * Whether a text layer holds text to read, rather than text used as a shape:
 * a mask, a part of a boolean operation, or icon font glyphs.
 */
function isReadableText(node: TextNode): boolean {
    if (node.isMask) return false;
    const characters = Array.from(node.characters.replace(/\s+/g, ""));
    if (characters.length === 0 || characters.every((character) => ICON_GLYPH.test(character))) return false;

    for (let current = node.parent; current !== null && current.type !== "PAGE"; current = current.parent) {
        if (current.type === "BOOLEAN_OPERATION") return false;
    }
    return true;
}

function isRendered(node: SceneNode): boolean {
    let current: BaseNode | null = node;
    while (current !== null && current.type !== "PAGE" && current.type !== "DOCUMENT") {
        if ("visible" in current && !current.visible) return false;
        if ("opacity" in current && current.opacity <= 0) return false;
        current = current.parent;
    }
    return true;
}

function hasVisibleFill(node: TextNode): boolean {
    return typeof node.fills === "symbol"
        || node.fills.some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0);
}

function readTextColor(node: TextNode): SrgbColor | ColorProblem {
    const layers: SrgbColor[] = [];
    const outcome = collectFills(node.fills, inheritedOpacity(node), layers);
    if (outcome !== "opaque" && outcome !== "continue") return outcome;
    // Paints of one fill stack blend into the single colour the text shows.
    return blend(layers);
}

function readBackground(node: TextNode): SrgbColor | ColorProblem {
    const box = node.absoluteBoundingBox;
    const center: Point = box === null
        ? { x: node.absoluteTransform[0][2], y: node.absoluteTransform[1][2] }
        : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const layers: SrgbColor[] = [];

    let child: BaseNode = node;
    let parent = node.parent;
    let inheritedParentOpacity = 1;
    while (parent !== null) {
        if (parent.type === "PAGE") {
            const outcome = collectFills(parent.backgrounds, 1, layers);
            if (outcome !== "opaque" && outcome !== "continue") return outcome;
            break;
        }
        if (parent.type === "DOCUMENT") break;

        const parentOpacity = inheritedParentOpacity * opacityOf(parent);
        const siblings = parent.children;
        for (let index = siblings.indexOf(child as SceneNode) - 1; index >= 0; index--) {
            const outcome = layerAt(siblings[index], center, layers, parentOpacity);
            if (outcome === "opaque") return blend(layers);
            if (outcome !== "continue") return outcome;
        }
        if ("fills" in parent) {
            const fills = (parent as MinimalFillsMixin).fills;
            const outcome = collectFills(fills, parentOpacity, layers);
            if (outcome === "opaque") return blend(layers);
            if (outcome !== "continue") return outcome;
        }
        child = parent;
        parent = parent.parent;
        inheritedParentOpacity = parentOpacity;
    }

    // A canvas with no opaque layer renders on white.
    layers.push(WHITE);
    return blend(layers);
}

/**
 * Looks down through a node painted below the text, at the point under the
 * text's centre: first its children, top to bottom, then its own fills.
 */
function layerAt(node: SceneNode, point: Point, layers: SrgbColor[], inheritedOpacity: number): LayerOutcome {
    if (!node.visible || node.type === "TEXT" || node.type === "LINE" || !contains(node.absoluteBoundingBox, point)) {
        return "continue";
    }
    const opacity = inheritedOpacity * opacityOf(node);
    if (opacity <= 0) return "continue";
    if ("children" in node) {
        for (let index = node.children.length - 1; index >= 0; index--) {
            const outcome = layerAt(node.children[index], point, layers, opacity);
            if (outcome !== "continue") return outcome;
        }
    }
    if ("fills" in node) {
        return collectFills(node.fills, opacity, layers);
    }
    return "continue";
}

/**
 * Adds the visible paints of a fill stack to `layers`, top paint first, and
 * stops at the first opaque one.
 */
function collectFills(fills: readonly Paint[] | PluginAPI["mixed"], opacity: number, layers: SrgbColor[]): LayerOutcome {
    if (typeof fills === "symbol") return "mixed";

    const visible = fills.filter((paint) => paint.visible !== false);
    for (let index = visible.length - 1; index >= 0; index--) {
        const paint = visible[index];
        const alpha = (paint.opacity ?? 1) * opacity;
        if (alpha <= 0) continue;
        if (paint.type !== "SOLID") {
            return paint.type.startsWith("GRADIENT") ? "gradient" : "image";
        }
        layers.push({ red: paint.color.r, green: paint.color.g, blue: paint.color.b, alpha });
        if (alpha >= 1) return "opaque";
    }
    return "continue";
}

function inheritedOpacity(node: BaseNode): number {
    let opacity = 1;
    let current: BaseNode | null = node;
    while (current !== null && current.type !== "PAGE" && current.type !== "DOCUMENT") {
        opacity *= opacityOf(current);
        current = current.parent;
    }
    return opacity;
}

function opacityOf(node: BaseNode): number {
    return "opacity" in node ? node.opacity : 1;
}

/** Blends layers collected top first into the colour seen through them. */
function blend(layers: SrgbColor[]): SrgbColor {
    return layers.reduceRight((below, above) => compositeOver(above, below));
}

function contains(box: Rect | null, point: Point): boolean {
    return box !== null
        && point.x >= box.x && point.x <= box.x + box.width
        && point.y >= box.y && point.y <= box.y + box.height;
}

function readFontSize(node: TextNode): number | undefined {
    if (typeof node.fontSize === "number") return node.fontSize;
    // Mixed sizes: the smallest one is the hardest to read.
    const sizes = node.getStyledTextSegments(["fontSize"]).map((segment) => segment.fontSize);
    return sizes.length === 0 ? undefined : Math.min(...sizes);
}

function readFontWeight(node: TextNode): number | undefined {
    if (typeof node.fontWeight === "number") return node.fontWeight;
    // Mixed weights: the lightest one decides whether large text is bold.
    const weights = node.getStyledTextSegments(["fontWeight"]).map((segment) => segment.fontWeight);
    return weights.length === 0 ? undefined : Math.min(...weights);
}

/**
 * Reads the line height as a multiple of the font size, for text that wraps
 * onto several lines; the spacing of a single line does not affect reading.
 */
function readLineHeight(node: TextNode, fontSizePx: number | undefined): number | undefined {
    const lineHeight = node.lineHeight;
    if (typeof lineHeight === "symbol" || lineHeight.unit === "AUTO" || fontSizePx === undefined || fontSizePx === 0) {
        return undefined;
    }
    const ratio = lineHeight.unit === "PERCENT" ? lineHeight.value / 100 : lineHeight.value / fontSizePx;
    return isMultiline(node, ratio * fontSizePx) ? ratio : undefined;
}

function isMultiline(node: TextNode, lineHeightPx: number): boolean {
    // A layer at least one and a half lines tall holds a second line.
    return node.characters.trim().includes("\n") || node.height >= lineHeightPx * 1.5;
}

/**
 * Names of the frames and groups containing a node, outermost first, e.g.
 * `Card / Product`, starting with the page name when `includePage` is set.
 */
export function nodePath(node: SceneNode, includePage: boolean): string {
    const names: string[] = [];
    let current = node.parent;
    while (current !== null && current.type !== "DOCUMENT") {
        if (current.type !== "PAGE" || includePage) {
            names.unshift(current.name);
        }
        current = current.parent;
    }
    return names.join(" / ");
}
