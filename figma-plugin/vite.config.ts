import path from "node:path";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

export default defineConfig({
    build: {
        emptyOutDir: false,
        outDir: ".figma-build",
        lib: {
            entry: path.resolve(__dirname, "src/code.ts"),
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
