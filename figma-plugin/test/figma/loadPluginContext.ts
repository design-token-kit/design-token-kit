import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PluginTestContext = {
    convertFigmaVariablesToDtcg: typeof convertFigmaVariablesToDtcg;
    convertFigmaVariablesToDtcgForModes: typeof convertFigmaVariablesToDtcgForModes;
    createSingleModeDtcgExportArtifact: typeof createSingleModeDtcgExportArtifact;
    createMultiModeDtcgExportArtifacts: typeof createMultiModeDtcgExportArtifacts;
    createDtcgPreviewFromArtifacts: typeof createDtcgPreviewFromArtifacts;
    validateDtcgArtifactsWithCore: typeof validateDtcgArtifactsWithCore;
    convertDtcgArtifactsToCssWithCore: typeof convertDtcgArtifactsToCssWithCore;
};

export function loadPluginContext(): PluginTestContext {
    const codePath = path.join(__dirname, "..", "..", "code.js");
    const code = readFileSync(codePath, "utf8");
    const context = {
        __html__: "",
        console: globalThis.console,
        figma: {
            showUI() {},
            notify() {},
            variables: {
                async getLocalVariablesAsync() {
                    return [];
                },
                async getLocalVariableCollectionsAsync() {
                    return [];
                },
            },
            ui: {
                postMessage() {},
            },
        },
    };

    vm.createContext(context);
    vm.runInContext(code, context);

    return context as PluginTestContext;
}

export function toPlainJson<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
}
