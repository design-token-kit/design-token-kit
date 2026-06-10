import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    clean: true,
    format: ["esm"],
    outDir: process.env.BIN_OUT_DIR ?? "bin",
    platform: "node",
    target: "node18",
    sourcemap: false,
    splitting: false,
    bundle: true,
    external: ["@design-token-kit/core", "commander"],
    shims: false,
    dts: false,
    outExtension() {
        return { js: ".mjs" };
    },
    banner: {
        js: "#!/usr/bin/env node",
    },
});
