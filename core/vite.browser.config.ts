import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            {
                find: "#/core/io/DtcgListLoader",
                replacement: path.resolve(currentDir, "src/browser/BrowserDtcgListLoader.ts"),
            },
            {
                find: /^#\/(.*)$/,
                replacement: `${path.resolve(currentDir, "src")}/$1`,
            },
        ],
    },
    build: {
        emptyOutDir: false,
        outDir: "lib",
        target: "es2022",
        lib: {
            entry: path.resolve(currentDir, "src/browser.ts"),
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
            root: path.resolve(currentDir, ".."),
            tsconfigPath: path.resolve(currentDir, "tsconfig.json"),
            outDirs: path.resolve(currentDir, "lib"),
            entryRoot: path.resolve(currentDir, "src"),
            include: [path.resolve(currentDir, "src/**/*.ts")],
            // src/index.ts would emit lib/index.d.ts over the main build types.
            exclude: [path.resolve(currentDir, "src/**/*.test.ts"), path.resolve(currentDir, "src/index.ts")],
            bundleTypes: true,
        }),
    ],
});
