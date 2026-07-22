import { CheckRunner } from "#/core/check/CheckRunner";
import { validationChecks, lintingChecks } from "#/core/check/checks/Checks";
import type { CheckIssue } from "#/core/check/CheckIssue";
import { TokenLayers } from "#/core/check/TokenLayers";
import { DtcgJsonReader } from "#/core/io/DtcgJsonReader";
import { DtcgList } from "#/core/model/DtcgList";
import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenPath } from "#/core/model/TokenPath";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import { ColorCssSerializer } from "#/core/platforms/css/ColorCssSerializer";
import type { DtcgExportArtifact } from "./figma-dtcg-export";

export type CoreRuntimeIssue = {
    path: string;
    code: string;
    message: string;
    severity: "error" | "warning";
};

export type CoreRuntimeValidationResult = {
    issues: CoreRuntimeIssue[];
};

export function validateDtcgArtifactsWithCore(
    artifacts: readonly DtcgExportArtifact[],
    options: { includeLint?: boolean } = {},
): CoreRuntimeValidationResult {
    const list: DtcgList = createDtcgListFromArtifacts(artifacts);
    const issues: CoreRuntimeIssue[] = mapCoreIssues(
        new CheckRunner(validationChecks(), TokenLayers.default()).runList(list),
    );

    if (!hasErrors(issues) && options.includeLint) {
        issues.push(...mapCoreIssues(
            new CheckRunner(lintingChecks(), TokenLayers.default()).runList(list),
        ));
    }

    return { issues };
}

export function convertDtcgArtifactsToCssWithCore(
    artifacts: readonly DtcgExportArtifact[],
): string {
    return convertDtcgListToCss(createDtcgListFromArtifacts(artifacts));
}

function createDtcgListFromArtifacts(
    artifacts: readonly DtcgExportArtifact[],
): DtcgList {
    if (artifacts.length === 0) {
        throw new Error("No DTCG export artifacts were generated.");
    }

    const baseArtifact: DtcgExportArtifact = artifacts.find((artifact) => artifact.isBase)
        ?? artifacts[0]!;
    const themeArtifacts: DtcgExportArtifact[] = artifacts.filter(
        (artifact) => artifact !== baseArtifact,
    );
    const reader = new DtcgJsonReader();
    const baseDocument = reader.parse(baseArtifact.content, baseArtifact.fileName);
    const themes = new Map(
        themeArtifacts.map((artifact) => [
            extractThemeNameFromArtifact(artifact),
            reader.parse(artifact.content, artifact.fileName),
        ]),
    );

    return new DtcgList(baseDocument, themes);
}

function extractThemeNameFromArtifact(artifact: DtcgExportArtifact): string {
    const fileName = artifact.fileName;
    const withoutExt = fileName.replace(/\.(json|ya?ml|design\.md|md)$/i, "");
    const parts = withoutExt.split(".");

    while (parts.length > 1 && isNonThemeSuffix(parts[parts.length - 1]!)) {
        parts.pop();
    }

    return parts.length > 1 ? parts[parts.length - 1]! : artifact.modeLabel;
}

function isNonThemeSuffix(segment: string): boolean {
    return segment === "dtcg" || segment === "hrdt" || segment === "valid" || segment === "invalid";
}

function mapCoreIssues(issues: readonly CheckIssue[]): CoreRuntimeIssue[] {
    return issues.map((issue) => ({
        path: issue.tokenPath?.toString() ?? "",
        code: `core:${issue.id}`,
        message: issue.message,
        severity: issue.severity,
    }));
}

function hasErrors(issues: readonly CoreRuntimeIssue[]): boolean {
    return issues.some((issue) => issue.severity === "error");
}

const colorCssSerializer = new ColorCssSerializer();

function convertDtcgListToCss(list: DtcgList): string {
    const blocks: string[] = [];

    const baseBlock = renderBlock(":root", collectFromDoc(list.base));
    if (baseBlock) blocks.push(baseBlock);

    for (const [themeName, theme] of list.themes) {
        const block = renderBlock(`:root[data-theme="${themeName}"]`, collectFromDoc(theme));
        if (block) blocks.push(block);
    }

    return blocks.join("\n\n") + (blocks.length > 0 ? "\n" : "");
}

function tokenPathToCssVar(path: string): string {
    return `--${path.replace(/\./g, "-")}`;
}

function refToCssVar(ref: TokenReference): string {
    return `var(${tokenPathToCssVar(ref.value)})`;
}

function colorToCss(color: ColorValue): string {
    return colorCssSerializer.serialize(color);
}

function dimensionOrRefToCss(value: DimensionValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `${value.value}${value.unit}`;
}

function durationOrRefToCss(value: DurationValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `${value.value}${value.unit}`;
}

function timingOrRefToCss(value: CubicBezierValue | TokenReference): string {
    if (value instanceof TokenReference) return refToCssVar(value);
    return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
}

function shadowLayerToCss(layer: ShadowLayer): string {
    const inset = layer.inset ? "inset " : "";
    return `${inset}${dimensionOrRefToCss(layer.offsetX)} ${dimensionOrRefToCss(layer.offsetY)} ${dimensionOrRefToCss(layer.blur)} ${dimensionOrRefToCss(layer.spread)} ${layer.color instanceof TokenReference ? refToCssVar(layer.color) : colorToCss(layer.color)}`;
}

function typographyToCss(value: TypographyValue): string {
    const fontFamily = value.fontFamily instanceof TokenReference
        ? refToCssVar(value.fontFamily)
        : Array.isArray(value.fontFamily)
            ? value.fontFamily
                .map((item) => item instanceof TokenReference ? refToCssVar(item) : `"${item}"`)
                .join(", ")
            : `"${value.fontFamily}"`;
    const fontWeight = value.fontWeight instanceof TokenReference
        ? refToCssVar(value.fontWeight)
        : String(value.fontWeight);
    const lineHeight = value.lineHeight instanceof TokenReference
        ? refToCssVar(value.lineHeight)
        : String(value.lineHeight);

    return `${fontWeight} ${dimensionOrRefToCss(value.fontSize)}/${lineHeight} ${fontFamily}`;
}

function gradientToCss(value: Array<GradientStop | TokenReference>): string {
    const stops = value.map((stop) => {
        if (stop instanceof TokenReference) return refToCssVar(stop);

        const color = stop.color instanceof TokenReference ? refToCssVar(stop.color) : colorToCss(stop.color);
        const position = stop.position instanceof TokenReference
            ? `calc(${refToCssVar(stop.position)} * 100%)`
            : `${stop.position * 100}%`;

        return `${color} ${position}`;
    });

    return `linear-gradient(180deg, ${stops.join(", ")})`;
}

function tokenValueToCss(value: unknown): string | undefined {
    if (value instanceof TokenReference) return refToCssVar(value);
    if (value instanceof ColorValue) return colorToCss(value);
    if (value instanceof DimensionValue) return `${value.value}${value.unit}`;
    if (value instanceof DurationValue) return `${value.value}${value.unit}`;
    if (value instanceof CubicBezierValue) return `cubic-bezier(${value.p1x}, ${value.p1y}, ${value.p2x}, ${value.p2y})`;
    if (typeof value === "number") return String(value);
    if (typeof value === "string") return value;

    if (value instanceof ShadowLayer) return shadowLayerToCss(value);

    if (value instanceof BorderValue) {
        const width = dimensionOrRefToCss(value.width);
        const style = value.style instanceof TokenReference
            ? refToCssVar(value.style)
            : value.style instanceof StrokeStyleObject ? "dashed" : value.style;
        const color = value.color instanceof TokenReference ? refToCssVar(value.color) : colorToCss(value.color);
        return `${width} ${style} ${color}`;
    }

    if (value instanceof TransitionValue) {
        return `${durationOrRefToCss(value.duration)} ${timingOrRefToCss(value.timingFunction)} ${durationOrRefToCss(value.delay)}`;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return undefined;
        if (value[0] instanceof GradientStop || (value[0] instanceof TokenReference && !(value[0] instanceof ShadowLayer))) {
            if (value.every((item) => item instanceof GradientStop || item instanceof TokenReference)) {
                const isGradient = value.some((item) => item instanceof GradientStop);
                if (isGradient) return gradientToCss(value);
            }
        }
        if (value[0] instanceof ShadowLayer || value[0] instanceof TokenReference) {
            const parts = value.map((item) =>
                item instanceof ShadowLayer ? shadowLayerToCss(item) : refToCssVar(item as TokenReference),
            );
            return parts.join(", ");
        }
        return value.map((item) =>
            item instanceof TokenReference ? refToCssVar(item) : `"${item}"`,
        ).join(", ");
    }

    if (value instanceof TypographyValue) return typographyToCss(value);

    return undefined;
}

function collectDeclarations(group: TokenGroup, path: TokenPath): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of group.entries()) {
        const childPath = path.child(key);
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, childPath));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value);
            if (css !== undefined) {
                result.push([tokenPathToCssVar(childPath.toString()), css]);
            }
        }
    }
    return result;
}

function collectFromDoc(doc: Dtcg): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    for (const [key, child] of doc.entries()) {
        if (child instanceof TokenGroup) {
            result.push(...collectDeclarations(child, TokenPath.of(key)));
        } else if (child instanceof TokenNode) {
            const css = tokenValueToCss(child.value);
            if (css !== undefined) result.push([tokenPathToCssVar(TokenPath.of(key).toString()), css]);
        }
    }
    return result;
}

function renderBlock(selector: string, declarations: Array<[string, string]>): string {
    if (declarations.length === 0) return "";
    const lines = declarations.map(([prop, val]) => `  ${prop}: ${val};`).join("\n");
    return `${selector} {\n${lines}\n}`;
}
