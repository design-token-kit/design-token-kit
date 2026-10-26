import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const coreSource = resolve(currentDir, "../core/src");

export default defineConfig({
    resolve: {
        // The extension imports core modules one by one, as the Figma plugin
        // does, so the bundles hold only the CSS tracing code.
        alias: [
            { find: /^#\/browser-extension\/(.*)$/, replacement: `${resolve(currentDir, "src")}/$1` },
            { find: /^@design-token-kit\/core\/(.*)$/, replacement: `${coreSource}/$1` },
            { find: /^#\/(.*)$/, replacement: `${coreSource}/$1` },
        ],
    },
    publicDir: "static",
    build: {
        outDir: "dist",
        target: "es2022",
        lib: {
            entry: {
                background: resolve(currentDir, "src/background/background.ts"),
                devtools: resolve(currentDir, "src/devtools/devtools.ts"),
                panel: resolve(currentDir, "src/panel/panel.ts"),
            },
            formats: ["es"],
            fileName: (_format, entryName) => `${entryName}.js`,
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        environment: "node",
        coverage: {
            provider: "istanbul",
            include: ["src/**/*.ts"],
            reporter: ["text", "json", "html", "lcov"],
        },
    },
});
