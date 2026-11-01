/**
 * Minimal stand-ins for Figma scene nodes, enough for the design audit to walk
 * a page: types, names, fills, bounds, visibility and the parent links.
 */

type FakeNode = Record<string, unknown> & { children?: FakeNode[]; parent?: FakeNode | null };

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function solid(hex: string, opacity = 1): Paint {
    const value = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    return { type: "SOLID", color: { r, g, b }, opacity, visible: true } as SolidPaint;
}

export function gradient(): Paint {
    return { type: "GRADIENT_LINEAR", gradientStops: [], gradientTransform: [[1, 0, 0], [0, 1, 0]], visible: true } as GradientPaint;
}

export function image(): Paint {
    return { type: "IMAGE", scaleMode: "FILL", imageHash: null, visible: true } as ImagePaint;
}

export function page(name: string, children: FakeNode[], backgrounds: Paint[] = [solid("#ffffff")]): PageNode {
    return link({ type: "PAGE", id: `page:${name}`, name, backgrounds, children }) as unknown as PageNode;
}

export function frame(name: string, box: Box, fills: Paint[], children: FakeNode[] = []): FakeNode {
    return { type: "FRAME", id: `frame:${name}`, name, visible: true, opacity: 1, fills, absoluteBoundingBox: box, children };
}

export function rect(name: string, box: Box, fills: Paint[], extra: Record<string, unknown> = {}): FakeNode {
    return { type: "RECTANGLE", id: `rect:${name}`, name, visible: true, opacity: 1, fills, absoluteBoundingBox: box, ...extra };
}

export function group(name: string, box: Box, children: FakeNode[], extra: Record<string, unknown> = {}): FakeNode {
    return { type: "GROUP", id: `group:${name}`, name, visible: true, opacity: 1, absoluteBoundingBox: box, children, ...extra };
}

export function booleanOperation(name: string, box: Box, fills: Paint[], fillGeometry: VectorPath[] = [], children: FakeNode[] = []): FakeNode {
    return {
        type: "BOOLEAN_OPERATION",
        id: `boolean:${name}`,
        name,
        visible: true,
        opacity: 1,
        fills,
        absoluteBoundingBox: box,
        absoluteTransform: [[1, 0, box.x], [0, 1, box.y]],
        fillGeometry,
        children,
    };
}

export function vector(name: string, box: Box, fills: Paint[], fillGeometry: VectorPath[] = [], extra: Record<string, unknown> = {}): FakeNode {
    return {
        type: "VECTOR",
        id: `vector:${name}`,
        name,
        visible: true,
        opacity: 1,
        fills,
        absoluteBoundingBox: box,
        absoluteTransform: [[1, 0, box.x], [0, 1, box.y]],
        fillGeometry,
        ...extra,
    };
}

export function section(name: string, box: Box, fills: Paint[], children: FakeNode[] = []): FakeNode {
    return { type: "SECTION", id: `section:${name}`, name, visible: true, fills, absoluteBoundingBox: box, children };
}

export function text(name: string, box: Box, options: Partial<TextOptions> = {}): FakeNode {
    const settings: TextOptions = {
        fills: [solid("#000000")],
        fontSize: 16,
        fontWeight: 400,
        lineHeight: { unit: "PERCENT", value: 150 },
        characters: name,
        visible: true,
        opacity: 1,
        segments: [],
        absoluteBoundingBox: box,
        height: box.height,
        isMask: false,
        ...options,
    };
    const { segments, ...properties } = settings;
    return {
        type: "TEXT",
        id: `text:${name}`,
        name,
        absoluteTransform: [[1, 0, box.x], [0, 1, box.y]],
        ...properties,
        getStyledTextSegments: () => segments,
    };
}

export interface TextOptions {
    fills: Paint[] | symbol;
    fontSize: number | symbol;
    fontWeight: number | symbol;
    lineHeight: LineHeight | symbol;
    characters: string;
    visible: boolean;
    opacity: number;
    /** What `getStyledTextSegments` returns, for text with mixed styles. */
    segments: Array<{ fontSize?: number; fontWeight?: number }>;
    absoluteBoundingBox: Box | null;
    height: number;
    isMask: boolean;
}

/** Finds the text nodes of a page, as `findAllWithCriteria({ types: ["TEXT"] })` would. */
export function textNodes(root: PageNode): TextNode[] {
    const found: TextNode[] = [];
    const visit = (node: FakeNode): void => {
        if (node.type === "TEXT") found.push(node as unknown as TextNode);
        node.children?.forEach(visit);
    };
    (root as unknown as FakeNode).children?.forEach(visit);
    return found;
}

function link(node: FakeNode, parent: FakeNode | null = null): FakeNode {
    node.parent = parent;
    node.children?.forEach((child) => link(child, node));
    return node;
}
