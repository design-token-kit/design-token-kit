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
export type ColorProblem = "gradient" | "image" | "mixed" | "uncertain";

const PROBLEM_MESSAGES: Record<ColorProblem, string> = {
    gradient: "the text or its background is a gradient, so the ratio cannot be calculated.",
    image: "the text sits on an image, so the ratio cannot be calculated.",
    mixed: "the text has several colours, so the ratio cannot be calculated for one.",
    uncertain: "the background could not be determined reliably, so the ratio cannot be calculated.",
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
        const childIndex = siblings.findIndex((sibling) => sibling.id === child.id);
        if (childIndex < 0) return "uncertain";
        for (let index = childIndex - 1; index >= 0; index--) {
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
        const fills = node.fills;
        if (hasVisiblePaint(fills)) {
            const coverage = geometryCoverage(node, point);
            if (coverage === "uncertain") return "uncertain";
            if (coverage === "outside") return "continue";
        }
        return collectFills(fills, opacity, layers);
    }
    return "continue";
}

type GeometryCoverage = "inside" | "outside" | "uncertain";

/**
 * Bounding boxes are not sufficient for Boolean and vector nodes: their
 * geometry can leave parts of the box transparent. Figma exposes the actual
 * fill paths for these nodes, so use them before treating a paint as opaque.
 */
function geometryCoverage(node: SceneNode, point: Point): GeometryCoverage {
    if (node.type !== "BOOLEAN_OPERATION" && node.type !== "VECTOR") return "inside";

    try {
        const localPoint = inverseTransform(node.absoluteTransform, point);
        const paths = node.fillGeometry;
        if (paths.length === 0) return "uncertain";
        let parsedPath = false;
        for (const path of paths) {
            const polygons = parsePath(path.data);
            if (polygons === undefined) return "uncertain";
            parsedPath = true;
            if (path.windingRule !== "NONE" && pointInPath(polygons, path.windingRule, localPoint)) {
                return "inside";
            }
        }
        return parsedPath ? "outside" : "uncertain";
    } catch {
        // Older or partial plugin node implementations may not expose geometry.
        return "uncertain";
    }
}

function hasVisiblePaint(fills: readonly Paint[] | PluginAPI["mixed"]): boolean {
    return typeof fills === "symbol" || fills.some((paint) => paint.visible !== false && (paint.opacity ?? 1) > 0);
}

function inverseTransform(transform: Transform, point: Point): Point {
    const [[a, c, e], [b, d, f]] = transform;
    const determinant = a * d - b * c;
    if (determinant === 0) throw new Error("Node transform is not invertible");
    const x = point.x - e;
    const y = point.y - f;
    return {
        x: (d * x - c * y) / determinant,
        y: (a * y - b * x) / determinant,
    };
}

type PathPoint = Point;
type Polygon = PathPoint[];
type PathCommand = "M" | "L" | "Q" | "C" | "Z";

const PATH_TOKEN = /[MLQCZ]|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
const PATH_ARITY: Record<Exclude<PathCommand, "Z">, number> = { M: 2, L: 2, Q: 4, C: 6 };

function parsePath(data: string): Polygon[] | undefined {
    const tokens = data.match(PATH_TOKEN);
    if (tokens === null || tokens.length === 0) return undefined;

    const polygons: Polygon[] = [];
    let index = 0;
    let command: PathCommand | undefined;
    let current: PathPoint | undefined;
    let start: PathPoint | undefined;
    let polygon: Polygon | undefined;

    while (index < tokens.length) {
        if (isPathCommand(tokens[index])) {
            command = tokens[index] as PathCommand;
            index++;
            if (command === "Z") {
                if (polygon !== undefined && start !== undefined) {
                    polygon.push(start);
                    if (polygon.length >= 4) polygons.push(polygon);
                }
                current = start;
                polygon = undefined;
                command = undefined;
                continue;
            }
        }
        const drawCommand = command;
        if (drawCommand === undefined || drawCommand === "Z") return undefined;

        const arity = PATH_ARITY[drawCommand];
        if (index + arity > tokens.length || tokens.slice(index, index + arity).some(isPathCommand)) return undefined;
        const values = tokens.slice(index, index + arity).map(Number);
        if (values.some((value) => !Number.isFinite(value))) return undefined;
        index += arity;

        if (drawCommand === "M") {
            if (polygon !== undefined && polygon.length >= 3) polygons.push(polygon);
            current = { x: values[0], y: values[1] };
            start = current;
            polygon = [current];
            command = "L";
        } else if (drawCommand === "L" && current !== undefined && polygon !== undefined) {
            current = { x: values[0], y: values[1] };
            polygon.push(current);
        } else if (drawCommand === "Q" && current !== undefined && polygon !== undefined) {
            const end = { x: values[2], y: values[3] };
            polygon.push(...curvePoints(current, { x: values[0], y: values[1] }, undefined, end));
            current = end;
        } else if (drawCommand === "C" && current !== undefined && polygon !== undefined) {
            const end = { x: values[4], y: values[5] };
            polygon.push(...curvePoints(current, { x: values[0], y: values[1] }, { x: values[2], y: values[3] }, end));
            current = end;
        } else {
            return undefined;
        }
    }

    if (polygon !== undefined && polygon.length >= 3) polygons.push(polygon);
    return polygons;
}

function isPathCommand(token: string): boolean {
    return /^[MLQCZ]$/.test(token);
}

function curvePoints(start: Point, control: Point, secondControl: Point | undefined, end: Point): Point[] {
    const points: Point[] = [];
    for (let step = 1; step <= 12; step++) {
        const t = step / 12;
        const inverse = 1 - t;
        if (secondControl === undefined) {
            points.push({
                x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
                y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
            });
        } else {
            points.push({
                x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control.x + 3 * inverse * t ** 2 * secondControl.x + t ** 3 * end.x,
                y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control.y + 3 * inverse * t ** 2 * secondControl.y + t ** 3 * end.y,
            });
        }
    }
    return points;
}

function pointInPath(polygons: readonly Polygon[], windingRule: "NONZERO" | "EVENODD", point: Point): boolean {
    let winding = 0;
    let crossings = 0;
    for (const polygon of polygons) {
        for (let index = 1; index < polygon.length; index++) {
            const from = polygon[index - 1];
            const to = polygon[index];
            if (pointOnSegment(point, from, to)) return true;
            if ((from.y > point.y) !== (to.y > point.y)) {
                const intersection = from.x + (to.x - from.x) * (point.y - from.y) / (to.y - from.y);
                if (intersection > point.x) {
                    crossings++;
                    winding += to.y > from.y ? 1 : -1;
                }
            }
        }
    }
    return windingRule === "EVENODD" ? crossings % 2 === 1 : winding !== 0;
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
    const cross = (point.y - from.y) * (to.x - from.x) - (point.x - from.x) * (to.y - from.y);
    if (Math.abs(cross) > 1e-7) return false;
    return point.x >= Math.min(from.x, to.x) - 1e-7
        && point.x <= Math.max(from.x, to.x) + 1e-7
        && point.y >= Math.min(from.y, to.y) - 1e-7
        && point.y <= Math.max(from.y, to.y) + 1e-7;
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
