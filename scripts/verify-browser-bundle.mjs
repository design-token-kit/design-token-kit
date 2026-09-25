import { readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(scriptDir, "../core/lib/browser.js");
const typesPath = path.resolve(scriptDir, "../core/lib/browser.d.ts");
const browserBundle = await readFile(bundlePath, "utf8");

const builtins = new Set(builtinModules.flatMap((name) => [name, name.split("/")[0]]));
const specifiers = [
    ...browserBundle.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g),
].map((match) => match[1]);
const nodeImports = specifiers.filter((specifier) => (
    specifier.startsWith("node:") || builtins.has(specifier) || builtins.has(specifier.split("/")[0])
));
if (nodeImports.length > 0) {
    throw new Error(`Browser bundle must not import Node.js built-in modules: ${[...new Set(nodeImports)].join(", ")}.`);
}

verifyTypes();

await import(new URL("../core/lib/browser.js", import.meta.url));

console.log("Browser bundle imports without Node.js built-ins or eager DOM access, and its types compile without Node.js types.");

/**
 * Compiles a small consumer of the browser entry the way a web app would:
 * browser libraries only, no Node.js types.
 */
function verifyTypes() {
    const consumerPath = path.resolve(path.dirname(typesPath), "verify-browser-consumer.ts");
    const consumerSource = `
import {
    BrowserTokenToolkit,
    BrowserTokenValidationError,
    CheckScope,
    Format,
    type BrowserTokenOutput,
    type BrowserTokenSet,
    type CheckIssue,
    type TokenStat,
} from "./browser.js";

const input: BrowserTokenSet = { base: { content: "{}", source: "tokens.json", format: Format.DTCG } };
const toolkit = new BrowserTokenToolkit();
const issues: CheckIssue[] = toolkit.check(input, { scope: CheckScope.LINT, schema: "2025.10" });
const outputs: BrowserTokenOutput[] = toolkit.convert(input, "showcase");
const stats: readonly TokenStat[] = toolkit.stats(input);
export const result = { issues, outputs, stats, error: new BrowserTokenValidationError(issues) };
`;
    const options = {
        strict: true,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
        types: [],
    };
    const host = ts.createCompilerHost(options);
    const isConsumer = (fileName) => path.resolve(fileName) === consumerPath;
    const { getSourceFile, fileExists, readFile: readHostFile } = host;
    host.getSourceFile = (fileName, languageVersion, ...rest) => (isConsumer(fileName)
        ? ts.createSourceFile(fileName, consumerSource, languageVersion)
        : getSourceFile.call(host, fileName, languageVersion, ...rest));
    host.fileExists = (fileName) => isConsumer(fileName) || fileExists.call(host, fileName);
    host.readFile = (fileName) => (isConsumer(fileName) ? consumerSource : readHostFile.call(host, fileName));

    const program = ts.createProgram([consumerPath], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
        const formatted = ts.formatDiagnostics(diagnostics, {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => process.cwd(),
            getNewLine: () => "\n",
        });
        throw new Error(`Browser type declarations do not compile for a web consumer:\n${formatted}`);
    }
}
