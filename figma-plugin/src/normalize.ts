import type { FigmaNodeDto, FigmaDocumentDto } from "./FigmaFileReader";

interface RestLikeNode {
    id?: string;
    name?: string;
    type?: string;
    children?: RestLikeNode[];
}

interface RestLikeFileResponse {
    name?: string;
    document?: RestLikeNode;
    components?: Record<string, unknown>;
    componentSets?: Record<string, unknown>;
    styles?: Record<string, unknown>;
}

/**
 * Normalises a Figma REST-like file response into a {@link FigmaDocumentDto}.
 *
 * Handles both the REST API shape and the Plugin API shape — they share the
 * same document / components / styles structure.
 *
 * @param response - The raw file response from either source.
 */
export function normalizeFileResponse(response: RestLikeFileResponse): FigmaDocumentDto {
    const documentNode: RestLikeNode = response.document ?? {};
    const pages = Array.isArray(documentNode.children)
        ? documentNode.children.map(normalizeNode)
        : [];

    return {
        name: response.name ?? documentNode.name ?? "Untitled",
        pages,
        componentIds: Object.keys(response.components ?? {}),
        componentSetIds: Object.keys(response.componentSets ?? {}),
        styleIds: Object.keys(response.styles ?? {}),
    };
}

function normalizeNode(node: RestLikeNode): FigmaNodeDto {
    return {
        id: node.id ?? "",
        name: node.name ?? "",
        type: node.type ?? "UNKNOWN",
        children: Array.isArray(node.children)
            ? node.children.map(normalizeNode)
            : [],
    };
}
