import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "#": path.resolve(__dirname, "src"),
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        coverage: {
            // istanbul over v8: branch coverage feeds the CRAP gate (cscrap),
            // and v8 reports branches optimistically on complex code (measured
            // up to +12pp on TokenStatsBuilder), understating CRAP where it
            // matters. json is the format cscrap reads; html is for humans.
            provider: "istanbul",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/vite-env.d.ts"],
            reporter: ["text", "json", "html"],
        },
    },
});
