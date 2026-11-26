import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [{
            find: /^#\/(.*)$/,
            replacement: `${resolve(import.meta.dirname, "src")}/$1`,
        }],
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                background: resolve(import.meta.dirname, "src/background.ts"),
                panel: resolve(import.meta.dirname, "panel.html"),
            },
            output: {
                entryFileNames: "assets/[name].js",
            },
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        environment: "node",
    },
});
