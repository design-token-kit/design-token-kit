import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";
import path from "node:path";
import { cp } from "node:fs/promises";

const HRDT_SCHEMA_SOURCE_DIR = path.resolve(__dirname, "src/core/validation/hrdt/schemas");
const DTCG_SCHEMA_SOURCE_DIR = path.resolve(__dirname, "src/core/validation/dtcg/schemas");
const DESIGN_MD_SCHEMA_SOURCE_DIR = path.resolve(__dirname, "src/core/validation/design-md/schemas");

function copySchemas(outDir: string): Plugin {
    return {
        name: "copy-schemas",
        apply: "build",
        async closeBundle() {
            const destDir = path.resolve(__dirname, outDir, "schemas");
            await cp(HRDT_SCHEMA_SOURCE_DIR, destDir, { recursive: true });
            await cp(DTCG_SCHEMA_SOURCE_DIR, destDir, { recursive: true });
            await cp(DESIGN_MD_SCHEMA_SOURCE_DIR, destDir, { recursive: true });
        },
    };
}

const OUT_DIR = process.env.LIB_OUT_DIR ?? "lib";

export default defineConfig({
    build: {
        outDir: OUT_DIR,
        ssr: true,
        target: "node18",
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            formats: ["es"],
            fileName: () => "index.js",
        },
    },
    plugins: [
        dts({
            entryRoot: "src",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.test.ts"],
            bundleTypes: true,
        }),
        copySchemas(OUT_DIR),
    ],
});
