import path from "node:path";
import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function copyBrowserTypes(): Plugin {
    return {
        name: "copy-browser-types",
        apply: "build",
        async closeBundle() {
            await cp(
                path.resolve(currentDir, "src/browser.d.ts"),
                path.resolve(currentDir, "lib/browser.d.ts"),
            );
        },
    };
}

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
    plugins: [copyBrowserTypes()],
});
