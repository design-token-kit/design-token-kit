import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
