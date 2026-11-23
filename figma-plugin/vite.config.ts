import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
    const analyticsEnvironment = mode === "production"
        ? "production"
        : mode === "test"
            ? "test"
            : "development";

    return {
        define: {
            __DTK_ANALYTICS_ENABLED__: JSON.stringify(analyticsEnvironment === "production"),
            __DTK_ANALYTICS_ENVIRONMENT__: JSON.stringify(analyticsEnvironment),
        },
        resolve: {
            alias: [
                // Core converters import this loader for file-based `convert(sources)`.
                // The Figma plugin calls only `convertList()`, so the Node-only loader
                // is replaced with a runtime adapter before package-import resolution.
                {
                    find: "#/core/io/DtcgListLoader",
                    replacement: resolve(import.meta.dirname, "src/core-adapter/DtcgListLoader.ts"),
                },
                {
                    find: "#/core/formats/dtcg/dtcgSchema",
                    replacement: resolve(import.meta.dirname, "../core/src/browser/BrowserSchemaLoader.ts"),
                },
                {
                    find: "#/core/formats/design-md/designMdSchema",
                    replacement: resolve(import.meta.dirname, "../core/src/browser/BrowserSchemaLoader.ts"),
                },
                {
                    find: "#/core/formats/hrdt/hrdtSchema",
                    replacement: resolve(import.meta.dirname, "../core/src/browser/BrowserSchemaLoader.ts"),
                },
                {
                    find: /^#\/figma-plugin\/(.*)$/,
                    replacement: `${resolve(import.meta.dirname, "src")}/$1`,
                },
                {
                    find: /^@design-token-kit\/core\/(.*)$/,
                    replacement: `${resolve(import.meta.dirname, "../core/src")}/$1`,
                },
                {
                    find: "@design-token-kit/core",
                    replacement: resolve(import.meta.dirname, "../core/src/index.ts"),
                },
                {
                    find: /^#\/(.*)$/,
                    replacement: `${resolve(import.meta.dirname, "../core/src")}/$1`,
                },
            ],
        },
        build: {
            emptyOutDir: false,
            outDir: ".figma-build",
            lib: {
                entry: resolve(import.meta.dirname, "src/code.ts"),
                formats: ["iife"],
                name: "DesignTokenKitFigmaPlugin",
                fileName: () => "code.js",
            },
        },
        test: {
            include: ["test/**/*.test.ts"],
            environment: "node",
            coverage: {
                provider: "istanbul",
                include: ["src/**/*.ts"],
                reporter: ["text", "json", "html", "lcov"],
                thresholds: {
                    statements: 90,
                    branches: 81,
                    functions: 96,
                    lines: 91,
                },
            },
        },
    };
});
