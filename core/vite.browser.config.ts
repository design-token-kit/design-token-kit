import path from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    resolve: {
        alias: [
            {
                find: "#/core/io/DtcgListLoader",
                replacement: path.resolve(import.meta.dirname, "src/browser/BrowserDtcgListLoader.ts"),
            },
            {
                find: "#/core/formats/dtcg/dtcgSchema",
                replacement: path.resolve(import.meta.dirname, "src/browser/BrowserSchemaLoader.ts"),
            },
            {
                find: "#/core/formats/design-md/designMdSchema",
                replacement: path.resolve(import.meta.dirname, "src/browser/BrowserSchemaLoader.ts"),
            },
            {
                find: "#/core/formats/hrdt/hrdtSchema",
                replacement: path.resolve(import.meta.dirname, "src/browser/BrowserSchemaLoader.ts"),
            },
            {
                find: /^#\/(.*)$/,
                replacement: `${path.resolve(import.meta.dirname, "src")}/$1`,
            },
        ],
    },
    build: {
        emptyOutDir: false,
        outDir: "lib",
        target: "es2022",
        lib: {
            entry: path.resolve(import.meta.dirname, "src/browser.ts"),
            formats: ["es"],
            fileName: () => "browser.js",
        },
    },
    plugins: [
        dts({
            // The bundled types entry is taken from the nearest package.json
            // "types" field, which here is the main lib/index.d.ts. The
            // workspace root has none, so the entry falls back to the
            // library file name: lib/browser.d.ts.
            root: path.resolve(import.meta.dirname, ".."),
            tsconfigPath: path.resolve(import.meta.dirname, "tsconfig.json"),
            outDirs: path.resolve(import.meta.dirname, "lib"),
            entryRoot: path.resolve(import.meta.dirname, "src"),
            include: [path.resolve(import.meta.dirname, "src/**/*.ts")],
            // src/index.ts would emit lib/index.d.ts over the main build types.
            exclude: [path.resolve(import.meta.dirname, "src/**/*.test.ts"), path.resolve(import.meta.dirname, "src/index.ts")],
            bundleTypes: true,
        }),
    ],
});
