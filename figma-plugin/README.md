# Figma Plugin

This package exports the current Figma file JSON through two separate paths and
normalizes both into one internal DTO.

## Current scope

- exports `figma.plugin.json` through Plugin API
- exports `figma.rest.json` through the real Figma REST API
- exports `tokens.json` with DTCG tokens from Figma Variables or paint styles
- converts exported DTCG tokens to CSS, SCSS, Tailwind v4, and SwiftUI through
  `@design-token-kit/core`
- normalizes both payloads into one internal DTO
- previews the last exported JSON in the plugin UI
- shows token counts, skipped entries, and warnings in the plugin UI

## Export model

The export lives in:

- `figma-file-json.ts` - whole-document Plugin API export and shared DTO adapters
- `code.ts` - UI message handling and REST API fetch
- `token-export/TokenExporter.ts` - Figma token conversion to DTCG JSON
- `token-export/TokenConversionService.ts` - DTCG conversion through core platform converters
- `token-export/TokenNameMapper.ts` - Figma style / variable name to token path mapping

The internal DTO currently contains:

- file name
- page tree
- component ids
- component set ids
- style ids

The token export currently contains:

- color tokens from local Figma Variables
- dimension tokens from local Figma float Variables
- number tokens from local Figma float Variables used for opacity
- typography tokens from local Figma text styles
- shadow tokens from local Figma effect styles
- color variable aliases exported as DTCG references
- color variable modes exported as base and theme token files
- color tokens from local paint styles when no color variables exist

## Token naming convention

Use `/` in Figma variable and style names to define the token path.

Explicit token layers are preserved:

- `Primitive/Color/Blue/500` -> `primitive.color.blue.500`
- `Semantic/Color/Action/Primary` -> `semantic.color.action.primary`
- `Component/Button/Primary/Bg` -> `component.button.primary.bg`

When the layer is omitted, color names are exported under `primitive.color`:

- `Blue/500` -> `primitive.color.blue.500`

When the layer is omitted for float variables, the fallback group is inferred
from the variable scope or name:

- `4` with `GAP` scope -> `primitive.spacing.4`
- `Md` with `CORNER_RADIUS` scope -> `primitive.radius.md`
- `Disabled` with `OPACITY` scope -> `primitive.opacity.disabled`

When the layer is omitted for text styles, typography names are exported under
`component.typography`:

- `Heading/H1` -> `component.typography.heading.h1`

When the layer is omitted for effect styles, shadow names are exported under
`component.shadow`:

- `Card/Shadow` -> `component.shadow.card.shadow`

Name segments are normalized to lowercase kebab-case. Empty names and incomplete
explicit layer paths, such as `Primitive`, are skipped and reported as warnings.

## Variable aliases

Variable aliases are preserved when the alias target is another local variable of
the same exported token type with a valid token name:

- `Semantic/Color/Action/Primary` aliasing `Primitive/Color/Blue/500` -> `{primitive.color.blue.500}`
- `Semantic/Spacing/Md` aliasing `Primitive/Spacing/4` -> `{primitive.spacing.4}`

Aliases are not inferred by matching raw color values. If an alias target is not
available or cannot be mapped to a token path, the alias token is skipped and
reported as a warning.

## Variable modes and themes

When variables belong to a local variable collection with modes, the
collection default mode is exported to the base file:

- default mode -> `tokens.json`

Each non-default mode is exported to a separate theme file named from the mode:

- `Dark` -> `tokens.dark.json`
- `Brand A` -> `tokens.brand-a.json`

If variable collections are unavailable, the plugin falls back to a single
`tokens.json` file using the first value available on each exported variable.

## Text styles

Local Figma text styles are exported as DTCG `typography` tokens. The exporter
uses:

- `fontName.family` -> `fontFamily`
- `fontSize` -> `fontSize` dimension in `px`
- `fontName.style` -> numeric `fontWeight` best-effort mapping
- `letterSpacing` -> `letterSpacing` dimension in `px`
- `lineHeight` -> unitless `lineHeight` multiplier

## Effect styles

Local Figma effect styles are exported as DTCG `shadow` tokens when they contain
visible `DROP_SHADOW` or `INNER_SHADOW` effects. Multiple visible shadow effects
are exported as a multi-layer shadow value.

The exporter maps:

- effect color -> `color`
- offset `x` / `y` -> `offsetX` / `offsetY` dimensions in `px`
- `radius` -> `blur` dimension in `px`
- `spread` -> `spread` dimension in `px`
- `INNER_SHADOW` -> `inset: true`

Blur-only and other non-shadow effects are skipped and reported as warnings.

## Diagnostics

The main UI action downloads generated token files. Raw Plugin API and REST API
exports are kept in the diagnostic section and are intended only for debugging
Figma JSON differences. The UI also provides copy actions for the latest summary
and warnings to simplify issue reports.

## Scripts

- `npm run build` - compile TypeScript into `code.js`
- `npm run lint` - run ESLint
- `npm run test` - rebuild and run export/DTO tests with `vitest`
- `npm run watch` - rebuild on file changes

## Tests

Tests run the generated `code.js` inside a Node `vm` context with a minimal
mock of the Figma runtime and verify that REST-like and Plugin-like responses
normalize into the same DTO.
