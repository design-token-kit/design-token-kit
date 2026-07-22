import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    CheckScope,
    DtcgChecker,
    DtcgListLoader,
    DtcgTokenCssConverter,
    Format,
} from "../../../core/src/index.ts";
import { bothModes, lightMode, multiModeVariables, twoColorVariables } from "./fixtures/variable-sets";
import { loadPluginContext } from "./loadPluginContext";

const tempDirs: string[] = [];

function writeArtifacts(
    artifacts: readonly Pick<DtcgExportArtifact, "fileName" | "content">[],
): string[] {
    const dir = mkdtempSync(path.join(os.tmpdir(), "design-token-kit-figma-export-"));
    tempDirs.push(dir);

    return artifacts.map((artifact) => {
        const filePath = path.join(dir, artifact.fileName);
        writeFileSync(filePath, artifact.content, "utf8");
        return filePath;
    });
}

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe("figma export -> core", () => {
    it("runs pure core validation inside the bundled plugin runtime", () => {
        const context = loadPluginContext();
        const conversion = context.convertFigmaVariablesToDtcg(
            twoColorVariables,
            lightMode,
        );
        const artifact = context.createSingleModeDtcgExportArtifact(
            "Colors",
            lightMode,
            conversion.tree,
        );

        const result = context.validateDtcgArtifactsWithCore([artifact]);

        expect(result.issues).toEqual([]);
    });

    it("runs pure core conversion inside the bundled plugin runtime", () => {
        const context = loadPluginContext();
        const conversion = context.convertFigmaVariablesToDtcgForModes(
            multiModeVariables,
            bothModes,
        );
        const artifacts = context.createMultiModeDtcgExportArtifacts(
            "Colors",
            conversion.modeResults,
        );

        const css = context.convertDtcgArtifactsToCssWithCore(artifacts);

        expect(css).toContain(":root");
        expect(css).toContain(':root[data-theme="dark"]');
        expect(css).toContain("--primitive-color-background");
        expect(css).toContain("--semantic-color-link");
    });

    it("exports a single mode as a DTCG document valid for core", async () => {
        const context = loadPluginContext();
        const conversion = context.convertFigmaVariablesToDtcg(
            twoColorVariables,
            lightMode,
        );
        const artifact = context.createSingleModeDtcgExportArtifact(
            "Colors",
            lightMode,
            conversion.tree,
        );

        const issues = await new DtcgChecker({
            scope: CheckScope.VALIDATE,
            inform: Format.DTCG,
        }).validate(writeArtifacts([artifact]));

        expect(issues).toEqual([]);
    });

    it("exports all modes as base and theme files consumable by core", async () => {
        const context = loadPluginContext();
        const conversion = context.convertFigmaVariablesToDtcgForModes(
            multiModeVariables,
            bothModes,
        );
        const artifacts = context.createMultiModeDtcgExportArtifacts(
            "Colors",
            conversion.modeResults,
        );

        expect(artifacts.map((artifact) => artifact.fileName)).toEqual([
            "colors.dtcg.json",
            "colors.dark.dtcg.json",
        ]);

        const sources = writeArtifacts(artifacts);
        const issues = await new DtcgChecker({
            scope: CheckScope.VALIDATE,
            inform: Format.DTCG,
        }).validate(sources);

        expect(issues).toEqual([]);

        const list = await new DtcgListLoader().load(sources, Format.DTCG);
        expect([...list.themes.keys()]).toEqual(["dark"]);

        const css = new DtcgTokenCssConverter().convertList(list);
        expect(css).toContain(":root");
        expect(css).toContain(':root[data-theme="dark"]');
        expect(css).toContain("--primitive-color-background");
        expect(css).toContain("--semantic-color-link");
    });
});
