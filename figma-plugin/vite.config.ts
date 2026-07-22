import { copyFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

export default defineConfig(({ command }) => ({
    plugins: command === "build"
        ? [{
            name: "copy-figma-code-bundle",
            async closeBundle() {
                await copyFile(
                    path.resolve(__dirname, ".figma-build/code.js"),
                    path.resolve(__dirname, "code.js"),
                );
            },
        }]
        : [],
    resolve: {
        alias: {
            "#": path.resolve(__dirname, "../core/src"),
            ...(command === "build"
                ? {
                    "node:fs/promises": path.resolve(__dirname, "build-support/node-shims/fs-promises.ts"),
                    "node:fs": path.resolve(__dirname, "build-support/node-shims/fs.ts"),
                    "node:path": path.resolve(__dirname, "build-support/node-shims/path.ts"),
                }
                : {}),
        },
    },
    build: {
        emptyOutDir: false,
        outDir: ".figma-build",
        lib: {
            entry: path.resolve(__dirname, "code.ts"),
            formats: ["iife"],
            name: "DesignTokenKitFigmaPlugin",
            fileName: () => "code.js",
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        environment: "node",
    },
}));
