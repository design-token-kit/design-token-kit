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
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/vite-env.d.ts"],
            reporter: ["text", "html"],
        },
    },
});
