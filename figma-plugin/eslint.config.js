import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import figmaPlugin from "@figma/eslint-plugin-figma-plugins";

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            "@figma/figma-plugins": figmaPlugin,
        },
        // Figma plugin rules inspect argument types, so they need type information.
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            ...figmaPlugin.configs.recommended.rules,
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    {
        ignores: ["code.js", ".figma-build", "dist", "eslint.config.js"],
    },
);
