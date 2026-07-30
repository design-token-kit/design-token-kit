import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            // Core converters import this loader for file-based `convert(sources)`.
            // The Figma plugin calls only `convertList()`, so the Node-only loader
            // is replaced with a runtime adapter before the generic `#/...` alias.
            {
                find: "#/core/io/DtcgListLoader",
                replacement: resolve(currentDir, "src/core-adapter/DtcgListLoader.ts"),
            },
            {
                find: /^@design-token-kit\/core\/(.*)$/,
                replacement: `${resolve(currentDir, "../core/src")}/$1`,
            },
            {
                find: "@design-token-kit/core",
                replacement: resolve(currentDir, "../core/src/index.ts"),
            },
            {
                find: /^#\/(.*)$/,
                replacement: `${resolve(currentDir, "../core/src")}/$1`,
            },
        ],
    },
    build: {
        emptyOutDir: false,
        outDir: ".figma-build",
        lib: {
            entry: resolve(currentDir, "src/code.ts"),
            formats: ["iife"],
            name: "DesignTokenKitFigmaPlugin",
            fileName: () => "code.js",
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        environment: "node",
    },
});
