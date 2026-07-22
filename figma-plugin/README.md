# Figma Plugin

This package contains the Figma plugin UI layer for exporting local Figma
Variables to DTCG color tokens.

## Current scope

- reads local Figma Variables
- diagnoses empty local Variable results by reporting nearby Figma data sources
  visible through the Plugin API
- exports only Variables with `resolvedType === "COLOR"`
- supports direct RGBA values with DTCG `hex` fallback
- supports `COLOR` aliases as DTCG references
- supports cross-collection `COLOR` aliases when the target Variable can be resolved in the export lookup set
- maps Variable descriptions to `$description`
- preserves selected Figma-specific metadata in `$extensions["com.figma"]`
- exports one selected collection and one selected mode
- exports all modes for the selected collection by reusing the same
  single-mode conversion logic and wrapping the result into a multi-set document
- exports core-compatible DTCG JSON files:
  - single mode -> one `*.dtcg.json` document
  - all modes -> one base `*.dtcg.json` document plus `*.theme.dtcg.json` theme files
- runs in-memory `core` validation inside the plugin runtime (semantic checks, optional lint-ready layering)
- runs in-memory CSS conversion from exported DTCG artifacts inside the plugin runtime
- skips non-color Variables during color export
- reports path conflicts, unresolved aliases, cyclic aliases, and missing mode values
- previews the generated JSON in the plugin UI
- supports `Copy JSON` and `Download JSON`

## Not supported yet

- `FLOAT`, `STRING`, `BOOLEAN`, `TIMING`, and other non-color token types
- multiple collections in one export result
- default mode detection outside the explicit UI selection flow
- collections or modes encoded into a final project-wide token contract
- in-plugin runtime schema validation via `@design-token-kit/core`

## Conversion model

The conversion lives in `figma-to-dtcg.ts`.

The plugin entry point in `code.ts` is responsible only for:

- reading collections and Variables from the Figma API
- selecting the target collection and mode
- calling the pure conversion functions
- collecting file-level diagnostics for empty-state explanations
- sending the result to `ui.html`

For a single mode, the plugin returns one DTCG tree.

For direct color values, the generated token includes:

- `colorSpace`, `components`, and `alpha`
- `hex` derived from the sRGB components
- optional `$description` when the Variable description is not empty
- optional `$extensions["com.figma"]` when Figma-specific metadata is present

For all modes, the plugin runs the same single-mode converter once per mode and
returns one JSON document with:

- `$metadata.tokenSetOrder`
- `$themes`
- one token set per mode label

For downstream tooling, the plugin also prepares file artifacts in the shape
expected by `@design-token-kit/core`:

- the default collection mode becomes the base `*.dtcg.json` file
- every other mode becomes a theme file named `*.{theme}.dtcg.json`

This lets the exported files flow into `DtcgChecker`, `DtcgListLoader`, and the
CSS/SCSS/Tailwind converters without reshaping the token data first.

Inside the plugin runtime we currently use the pure in-memory layer of `core`:

- DTCG parsing
- semantic validation checks
- CSS conversion from parsed DTCG documents

The schema-validator and file-based loader entry points are still downstream-only.

## Scripts

- `npm run build` - compile TypeScript into `code.js`
- `npm run lint` - run ESLint
- `npm run test` - rebuild and run converter tests with `vitest`
- `npm run watch` - rebuild on file changes

## Tests

They run the generated `code.js` inside a Node `vm` context with a minimal mock
of the Figma runtime and then call the pure conversion functions directly.

Test files live under `test/figma/`:

- `figma-to-dtcg.test.ts` - converter scenarios
- `loadPluginContext.ts` - shared VM harness
- `fixtures/` - reusable Variable builders and named fixture sets

The covered scenarios include:

- direct color conversion
- alias conversion
- cross-collection alias export
- cyclic alias reporting
- unresolved alias reporting
- path conflicts
- missing mode values
- skipping non-color Variables
- token metadata mapping (`hex`, `$description`, `com.figma` extension)
- all-modes aggregation
- figma export -> core validation/conversion compatibility
- in-plugin pure-core validation and CSS conversion
