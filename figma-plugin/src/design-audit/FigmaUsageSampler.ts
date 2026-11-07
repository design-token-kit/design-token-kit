import type { TokenBinding, UsageProperty, UsageSample, UsageValue } from "@design-token-kit/core/core/audit/usage/UsageSample";
import { nodePath, type AuditedNode } from "#/figma-plugin/design-audit/FigmaTextSampler";
import { declaredTokenLayer } from "#/figma-plugin/token-export/TokenNameMapper";

/**
 * Builds {@link UsageSample}s from the layers of Figma pages, for the token
 * usage audit: one sample per colour, spacing, radius and font size a layer
 * renders with, bound to a variable or a style or hard-coded.
 *
 * Read properties:
 *
 * - solid fills and strokes, bound to a colour variable or a paint style;
 * - corner radii of frames and rectangles;
 * - the gap and the padding of auto layout frames;
 * - the font size of text, bound to a text style or a variable.
 *
 * Zero values, gradients and images are not read. Hidden layers, masks and
 * sections are left out, and so are the shapes inside a boolean operation,
 * which only cut its outline. Instances are left out with their content: their
 * properties come from the main component, which is audited where it is.
 */
export class FigmaUsageSampler {

    /**
     * Samples the properties of every layer of the pages.
     *
     * @param includePageInPath - Whether the node path starts with its page name,
     *   for audits that span several pages.
     */
    async sample(pages: readonly PageNode[], includePageInPath = false): Promise<SampledProperty[]> {
        const found: Array<{ node: SceneNode; property: RawProperty }> = [];
        const visit = (node: SceneNode): void => {
            readProperties(node).forEach((property) => found.push({ node, property }));
        };
        pages.forEach((page) => page.children.forEach((child) => walk(child, visit)));

        const bindings = await resolveBindings(found.map((entry) => entry.property.ref));
        const paths = new Map<string, AuditedNode>();
        const counts = new Map<string, number>();
        return found.map(({ node, property }) => {
            let audited = paths.get(node.id);
            if (audited === undefined) {
                audited = { id: node.id, name: node.name, path: nodePath(node, includePageInPath) };
                paths.set(node.id, audited);
            }
            const index = counts.get(node.id) ?? 0;
            counts.set(node.id, index + 1);
            return {
                sample: {
                    id: `${node.id}#${index}`,
                    label: node.name,
                    property: property.property,
                    part: property.part,
                    value: property.value,
                    binding: property.ref === undefined ? undefined : bindings.get(refKey(property.ref)),
                    variableModes: resolvedVariableModes(node),
                },
                node: audited,
                consumer: node,
            };
        });
    }
}

/**
 * A property's audit sample and the layer it belongs to.
 */
export interface SampledProperty {
    readonly sample: UsageSample;
    readonly node: AuditedNode;
    /** The Figma node used to resolve variable aliases and modes. */
    readonly consumer?: SceneNode;
}

interface BindingRef {
    readonly kind: "variable" | "style";
    readonly id: string;
}

interface RawProperty {
    readonly property: UsageProperty;
    readonly part?: string;
    readonly value: UsageValue;
    readonly ref?: BindingRef;
}

type Bound = Record<string, VariableAlias | VariableAlias[] | undefined>;

const CORNERS = [
    ["topLeftRadius", "top left"],
    ["topRightRadius", "top right"],
    ["bottomRightRadius", "bottom right"],
    ["bottomLeftRadius", "bottom left"],
] as const;

const PADDINGS = [
    ["paddingTop", "top"],
    ["paddingRight", "right"],
    ["paddingBottom", "bottom"],
    ["paddingLeft", "left"],
] as const;

function walk(node: SceneNode, visit: (node: SceneNode) => void): void {
    if (!node.visible || ("opacity" in node && node.opacity === 0) || node.type === "INSTANCE") return;
    if (node.type !== "SECTION" && !("isMask" in node && node.isMask)) {
        visit(node);
    }
    if (node.type === "BOOLEAN_OPERATION" || !("children" in node)) return;
    node.children.forEach((child) => walk(child, visit));
}

function readProperties(node: SceneNode): RawProperty[] {
    const bound = ("boundVariables" in node ? node.boundVariables ?? {} : {}) as Bound;
    const properties: RawProperty[] = [];

    if ("fills" in node) {
        properties.push(...paintProperties("fill", node.fills, node.fillStyleId));
    }
    if ("strokes" in node && node.strokeWeight !== 0) {
        properties.push(...paintProperties("stroke", node.strokes, node.strokeStyleId));
    }
    if ("topLeftRadius" in node) {
        properties.push(...radiusProperties(node, bound));
    }
    if ("layoutMode" in node && (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL")) {
        properties.push(...layoutProperties(node, bound));
    }
    if (node.type === "TEXT") {
        properties.push(...fontSizeProperties(node, bound));
    }
    return properties;
}

function paintProperties(
    property: "fill" | "stroke",
    paints: readonly Paint[] | PluginAPI["mixed"],
    styleId: string | PluginAPI["mixed"],
): RawProperty[] {
    // Text with several fills or styles across its characters.
    if (typeof paints === "symbol" || typeof styleId === "symbol") return [];

    return paints
        .filter((paint): paint is SolidPaint => paint.type === "SOLID" && paint.visible !== false && (paint.opacity ?? 1) > 0)
        .map((paint) => ({
            property,
            value: {
                type: "color",
                color: { red: paint.color.r, green: paint.color.g, blue: paint.color.b, alpha: paint.opacity ?? 1 },
            },
            ref: isStyleId(styleId) ? { kind: "style", id: styleId }
                : paint.boundVariables?.color === undefined ? undefined
                : { kind: "variable", id: paint.boundVariables.color.id },
        }));
}

function radiusProperties(node: SceneNode & RectangleCornerMixin & CornerMixin, bound: Bound): RawProperty[] {
    if (typeof node.cornerRadius === "number") {
        return node.cornerRadius > 0
            ? [dimension("corner-radius", node.cornerRadius, bound.topLeftRadius)]
            : [];
    }
    return CORNERS
        .filter(([field]) => node[field] > 0)
        .map(([field, part]) => dimension("corner-radius", node[field], bound[field], part));
}

function layoutProperties(node: SceneNode & AutoLayoutMixin, bound: Bound): RawProperty[] {
    const properties: RawProperty[] = [];
    // With "space between" the gap is computed from the free space.
    if (node.primaryAxisAlignItems !== "SPACE_BETWEEN" && node.itemSpacing > 0) {
        properties.push(dimension("gap", node.itemSpacing, bound.itemSpacing));
    }
    if (node.layoutWrap === "WRAP" && typeof node.counterAxisSpacing === "number" && node.counterAxisSpacing > 0) {
        properties.push(dimension("gap", node.counterAxisSpacing, bound.counterAxisSpacing, "between rows"));
    }
    for (const [field, part] of PADDINGS) {
        if (node[field] > 0) {
            properties.push(dimension("padding", node[field], bound[field], part));
        }
    }
    return properties;
}

function fontSizeProperties(node: TextNode, bound: Bound): RawProperty[] {
    if (typeof node.fontSize === "symbol" || typeof node.textStyleId === "symbol") return [];
    const property = dimension("font-size", node.fontSize, bound.fontSize);
    return isStyleId(node.textStyleId) ? [{ ...property, ref: { kind: "style", id: node.textStyleId } }] : [property];
}

function isStyleId(id: string | undefined): id is string {
    return typeof id === "string" && id !== "";
}

function dimension(
    property: UsageProperty,
    px: number,
    alias: VariableAlias | VariableAlias[] | undefined,
    part?: string,
): RawProperty {
    // Text properties hold one alias per range of characters.
    const id = Array.isArray(alias) ? alias[0]?.id : alias?.id;
    return { property, part, value: { type: "dimension", px }, ref: id === undefined ? undefined : { kind: "variable", id } };
}

/**
 * Looks up the names of the variables and styles the properties are bound to.
 * A binding whose variable or style no longer exists still counts as bound.
 */
async function resolveBindings(refs: ReadonlyArray<BindingRef | undefined>): Promise<Map<string, TokenBinding>> {
    const unique = new Map<string, BindingRef>();
    refs.forEach((ref) => {
        if (ref !== undefined) unique.set(refKey(ref), ref);
    });

    const entries = await Promise.all([...unique.entries()].map(async ([key, ref]): Promise<[string, TokenBinding]> => {
        const target = ref.kind === "variable"
            ? await figma.variables.getVariableByIdAsync(ref.id)
            : await figma.getStyleByIdAsync(ref.id);
        const name = target?.name ?? `missing ${ref.kind}`;
        return [key, { kind: ref.kind, name, layer: target === null ? undefined : declaredTokenLayer(name) }];
    }));
    return new Map(entries);
}

function refKey(ref: BindingRef): string {
    return `${ref.kind}:${ref.id}`;
}

function resolvedVariableModes(node: SceneNode): Readonly<Record<string, string>> | undefined {
    const modes = "resolvedVariableModes" in node ? node.resolvedVariableModes : undefined;
    if (modes === undefined) return undefined;
    return Object.keys(modes).length === 0 ? undefined : { ...modes };
}
