import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
        coverage: {
            // istanbul over v8: branch coverage feeds the CRAP gate (cscrap),
            // which v8 reports optimistically on complex code. json is the
            // format cscrap reads; html is for humans.
            provider: "istanbul",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts"],
            reporter: ["text", "json", "html"],
        },
    },
});
