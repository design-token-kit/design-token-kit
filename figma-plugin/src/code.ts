import { DesignAuditor } from "#/figma-plugin/design-audit/DesignAuditor";
import { FigmaTextSampler } from "#/figma-plugin/design-audit/FigmaTextSampler";
import { readTokenCandidates } from "#/figma-plugin/design-audit/FigmaTokenCandidates";
import { FigmaUsageSampler } from "#/figma-plugin/design-audit/FigmaUsageSampler";
import type { FigmaFileReader } from "#/figma-plugin/FigmaFileReader";
import { PluginFigmaFileReader, RestFigmaFileReader } from "#/figma-plugin/index";
import { TokenConversionService, type TokenOutputFormat } from "#/figma-plugin/token-export/TokenConversionService";
import { TokenCheckAnalyzer } from "#/figma-plugin/token-export/TokenCheckAnalyzer";
import { TokenAnalyticsAnalyzer } from "#/figma-plugin/token-export/TokenAnalyticsAnalyzer";
import { TokenExporter } from "#/figma-plugin/token-export/TokenExporter";
import { getOrCreateAnalyticsDistinctId } from "#/figma-plugin/analytics/AnalyticsIdentity";

const MISSING_FILE_KEY_MESSAGE = "REST export requires figma.fileKey. "
    + "Reload the plugin after manifest update or run it as a private/local plugin.";
const ANALYTICS_ENABLED = __DTK_ANALYTICS_ENABLED__;
const ANALYTICS_ENVIRONMENT = __DTK_ANALYTICS_ENVIRONMENT__;

figma.showUI(__html__, {
    width: 720,
    height: 720,
});

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === "EXPORT_PLUGIN_JSON") {
        await exportWithReader(new PluginFigmaFileReader());
        return;
    }

    if (msg.type === "ANALYZE_TOKENS") {
        await analyzeTokens(msg.linting === true);
        return;
    }

    if (msg.type === "AUDIT_DESIGN") {
        await auditDesign(msg.scope === "file" ? "file" : "page");
        return;
    }

    if (msg.type === "SELECT_NODES") {
        await selectNodes(msg.ids);
        return;
    }

    const tokenOutputFormat = toTokenOutputFormat(msg.type);
    if (tokenOutputFormat !== undefined) {
        await exportTokens(tokenOutputFormat);
        return;
    }

    if (msg.type === "EXPORT_REST_JSON") {
        const fileKey = figma.fileKey;
        if (fileKey === undefined) {
            figma.notify(MISSING_FILE_KEY_MESSAGE, { error: true });
            return;
        }

        await exportWithReader(new RestFigmaFileReader(msg.accessToken, fileKey));
    }
};

void initializeAnalytics();

async function initializeAnalytics(): Promise<void> {
    const distinctId = await getOrCreateAnalyticsDistinctId(figma.clientStorage);
    figma.ui.postMessage({
        type: "ANALYTICS_CONFIGURED",
        payload: {
            distinctId,
            enabled: ANALYTICS_ENABLED,
            environment: ANALYTICS_ENVIRONMENT,
        },
    });
}

async function analyzeTokens(runFullLinting: boolean): Promise<void> {
    try {
        const result = await new TokenExporter().export();
        const conversionService = new TokenConversionService();
        const listResult = await conversionService.readList(result.files);
        const checkReport = new TokenCheckAnalyzer().analyze(
            listResult.list,
            listResult.issues,
            result.files.flatMap((file) => file.architectureWarnings),
            runFullLinting,
        );
        const analyticsReport = new TokenAnalyticsAnalyzer().analyze(result.files, checkReport.checks);

        figma.ui.postMessage({
            type: "TOKENS_ANALYZED",
            payload: {
                summary: result.summary,
                warnings: [...result.warnings, ...checkReport.warnings],
                analytics: analyticsReport,
                architectureChecks: checkReport.checks,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "tokens",
                message,
            },
        });
    }
}

async function auditDesign(scope: "page" | "file"): Promise<void> {
    try {
        if (scope === "file") {
            await figma.loadAllPagesAsync();
        }
        const pages = scope === "file" ? figma.root.children : [figma.currentPage];
        const textNodes = pages.flatMap((page) => page.findAllWithCriteria({ types: ["TEXT"] }));
        const sampled = new FigmaTextSampler().sample(textNodes, scope === "file");
        const properties = await new FigmaUsageSampler().sample(pages, scope === "file");
        const consumers = properties.flatMap((entry) => entry.consumer === undefined ? [] : [entry.consumer]);
        const candidates = await readTokenCandidates(consumers);
        const report = new DesignAuditor().audit(sampled, properties, candidates);

        figma.ui.postMessage({
            type: "DESIGN_AUDITED",
            payload: { scope, ...report },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "DESIGN_AUDIT_FAILED",
            payload: { message },
        });
    }
}

/**
 * Selects nodes and brings them into view, switching to the page of the
 * first one; nodes on other pages are left out.
 */
async function selectNodes(ids: readonly string[]): Promise<void> {
    const found = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
    const nodes = found.filter((node): node is SceneNode => node !== null && isSceneNode(node));
    const page = nodes.length === 0 ? undefined : pageOf(nodes[0]);
    if (page === undefined) {
        figma.notify("The selected layers no longer exist.");
        return;
    }

    if (page.id !== figma.currentPage.id) {
        await figma.setCurrentPageAsync(page);
    }
    const onPage = nodes.filter((node) => pageOf(node)?.id === page.id);
    page.selection = onPage;
    figma.viewport.scrollAndZoomIntoView(onPage);
}

function isSceneNode(node: BaseNode): node is SceneNode {
    return node.type !== "DOCUMENT" && node.type !== "PAGE";
}

function pageOf(node: BaseNode): PageNode | undefined {
    let current: BaseNode | null = node;
    while (current !== null && current.type !== "PAGE") {
        current = current.parent;
    }
    return current ?? undefined;
}

async function exportTokens(format: TokenOutputFormat): Promise<void> {
    try {
        const result = await new TokenExporter().export();
        const files = await new TokenConversionService().convert({
            files: result.files,
            format,
        });

        figma.ui.postMessage({
            type: "TOKENS_EXPORTED",
            payload: {
                files,
                summary: result.summary,
                warnings: result.warnings,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "tokens",
                message,
            },
        });
    }
}

async function exportWithReader(reader: FigmaFileReader): Promise<void> {
    try {
        const raw = await reader.read();
        const dto = reader.normalize(raw);

        figma.ui.postMessage({
            type: "FILE_EXPORTED",
            payload: {
                source: reader.source,
                fileName: `${slugifyFileName(figma.root.name)}.${reader.source}.json`,
                content: JSON.stringify(raw, null, 2),
                dto,
            },
        });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        figma.notify(message, { error: true });
        figma.ui.postMessage({
            type: "EXPORT_FAILED",
            payload: {
                source: "plugin",
                message,
            },
        });
    }
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim() !== "") {
        return error.message;
    }

    if (typeof error === "string" && error.trim() !== "") {
        return error;
    }

    return "An unknown export error occurred.";
}

function slugifyFileName(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "figma";
}

function toTokenOutputFormat(type: PluginMessage["type"]): TokenOutputFormat | undefined {
    switch (type) {
        case "EXPORT_TOKENS_JSON":
        case "EXPORT_TOKENS_DTCG":
            return "dtcg";
        case "EXPORT_TOKENS_CSS":
            return "css";
        case "EXPORT_TOKENS_SCSS":
            return "scss";
        case "EXPORT_TOKENS_TAILWIND":
            return "tailwind-v4";
        case "EXPORT_TOKENS_ANDROID":
            return "android";
        case "EXPORT_TOKENS_SWIFTUI":
            return "swiftui";
        default:
            return undefined;
    }
}

type PluginMessage =
    | { type: "EXPORT_PLUGIN_JSON" }
    | { type: "ANALYZE_TOKENS"; linting?: boolean }
    | { type: "AUDIT_DESIGN"; scope?: "page" | "file" }
    | { type: "SELECT_NODES"; ids: string[] }
    | { type: "EXPORT_TOKENS_JSON" }
    | { type: "EXPORT_TOKENS_DTCG" }
    | { type: "EXPORT_TOKENS_CSS" }
    | { type: "EXPORT_TOKENS_SCSS" }
    | { type: "EXPORT_TOKENS_TAILWIND" }
    | { type: "EXPORT_TOKENS_ANDROID" }
    | { type: "EXPORT_TOKENS_SWIFTUI" }
    | { type: "EXPORT_REST_JSON"; accessToken: string };
