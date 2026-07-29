# Figma Plugin

This package exports the current Figma file JSON through two separate paths and
normalizes both into one internal DTO.

## Current scope

- exports `figma.plugin.json` through Plugin API
- exports `figma.rest.json` through the real Figma REST API
- exports `tokens.json` with DTCG color tokens from Figma Variables or paint styles
- normalizes both payloads into one internal DTO
- previews the last exported JSON in the plugin UI

## Export model

The export lives in:

- `figma-file-json.ts` - whole-document Plugin API export and shared DTO adapters
- `code.ts` - UI message handling and REST API fetch
- `tokens/FigmaTokenExporter.ts` - Figma color token conversion to DTCG JSON
- `tokens/FigmaTokenNameMapper.ts` - Figma style / variable name to token path mapping

The internal DTO currently contains:

- file name
- page tree
- component ids
- component set ids
- style ids

The token export currently contains:

- color tokens from local Figma Variables
- color variable aliases exported as DTCG references
- color tokens from local paint styles when no color variables exist

## Token naming convention

Use `/` in Figma variable and style names to define the token path.

Explicit token layers are preserved:

- `Primitive/Color/Blue/500` -> `primitive.color.blue.500`
- `Semantic/Color/Action/Primary` -> `semantic.color.action.primary`
- `Component/Button/Primary/Bg` -> `component.button.primary.bg`

When the layer is omitted, color names are exported under `primitive.color`:

- `Blue/500` -> `primitive.color.blue.500`

Name segments are normalized to lowercase kebab-case. Empty names and incomplete
explicit layer paths, such as `Primitive`, are skipped and reported as warnings.

## Variable aliases

Color variable aliases are preserved when the alias target is another local color
variable with a valid token name:

- `Semantic/Color/Action/Primary` aliasing `Primitive/Color/Blue/500` -> `{primitive.color.blue.500}`

Aliases are not inferred by matching raw color values. If an alias target is not
available or cannot be mapped to a token path, the alias token is skipped and
reported as a warning.

## Scripts

- `npm run build` - compile TypeScript into `code.js`
- `npm run lint` - run ESLint
- `npm run test` - rebuild and run export/DTO tests with `vitest`
- `npm run watch` - rebuild on file changes

## Tests

Tests run the generated `code.js` inside a Node `vm` context with a minimal
mock of the Figma runtime and verify that REST-like and Plugin-like responses
normalize into the same DTO.
