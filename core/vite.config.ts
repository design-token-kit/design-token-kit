import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";
import path from "node:path";
import { cp, readdir } from "node:fs/promises";

const FORMATS_DIR = "src/core/formats";

/**
 * Directory each format keeps its schemas in, and the one they are collected
 * into beside the bundle. A descriptor reaches its schema by the same relative
 * path in both layouts, which is what lets it name one location.
 */
const SCHEMAS_DIR = "schemas";

/**
 * Finds the `schemas` directory of every format, so adding a format needs no
 * change here.
 */
async function findSchemaDirs(): Promise<string[]> {
    const rootPath = path.resolve(__dirname, FORMATS_DIR);
    const entries = await readdir(rootPath, { withFileTypes: true });

    const dirs: string[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(rootPath, entry.name, SCHEMAS_DIR);
        const exists = await readdir(candidate).then(() => true, () => false);
        if (exists) dirs.push(candidate);
    }
    return dirs;
}

/**
 * Copies every format's schemas next to the bundle.
 *
 * The bundle flattens to a single file, so the schemas of all formats end up in
 * one directory and are resolved from there at runtime. They are kept as files
 * rather than bundled because the DTCG schema alone is 228K.
 */
function copySchemas(outDir: string): Plugin {
    return {
        name: "copy-schemas",
        apply: "build",
        async closeBundle() {
            const destDir = path.resolve(__dirname, outDir, SCHEMAS_DIR);
            const seen = new Map<string, string>();

            for (const dir of await findSchemaDirs()) {
                for (const entry of await readdir(dir)) {
                    const owner = seen.get(entry);
                    if (owner !== undefined) {
                        throw new Error(
                            `Schema "${entry}" is declared by two formats, "${owner}" and "${path.basename(path.dirname(dir))}". `
                            + "Names must be unique: the build collects every format's schemas into one directory.",
                        );
                    }
                    seen.set(entry, path.basename(path.dirname(dir)));
                }
                await cp(dir, destDir, { recursive: true });
            }
        },
    };
}

const OUT_DIR = process.env.LIB_OUT_DIR ?? "lib";

export default defineConfig({
    build: {
        outDir: OUT_DIR,
        ssr: true,
        target: "node20",
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
