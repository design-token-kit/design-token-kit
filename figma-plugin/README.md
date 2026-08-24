# Figma Plugin

Figma plugin for exporting design tokens from the current file.
It reads Figma Variables and local styles, writes DTCG token files, and converts
them through `@design-token-kit/core` to platform formats.

## Scope

- exports DTCG token files from local Figma Variables and styles
- converts tokens to CSS, SCSS, Tailwind v4, Android XML, and SwiftUI
- preserves local variable aliases as DTCG references when possible
- exports variable modes as theme files
- shows token counts, skipped entries, and warnings in the plugin UI
- keeps raw Plugin API and REST API JSON exports for diagnostics

## Scripts

- `npm run build` - compile TypeScript and build the plugin bundle
- `npm run lint` - run ESLint
- `npm run test` - rebuild and run Vitest tests
- `npm run watch` - rebuild on file changes

## Publishing The Plugin

Figma plugins can only be published from the **Figma Desktop app**.
See the [Figma publishing guide](https://help.figma.com/hc/en-us/articles/360042293394-Publish-plugins-to-the-Figma-Community).

### First Publication

1. Open **Figma Desktop**.
2. Go to **Figma menu -> Plugins -> Development -> Import plugin from
   manifest...**
3. Select the plugin's `manifest.json`.
4. Go to **Figma menu -> Plugins -> Development**.
5. Select **Design Token Kit** from the list of development plugins.
6. Open the plugin menu using **...**.
7. Select **Publish** and complete the publishing form.

### Publishing Updates

There is no need to import `manifest.json` again.

1. Open **Figma Desktop**.
2. Go to **Figma menu -> Plugins -> Development -> Manage plugins in
   development**.
3. Find **Design Token Kit** in the list.
4. Click **...** next to the plugin.
5. Select **Publish new version**.
6. Click **Publish**.

## Exported Tokens

The token exporter supports:

- `color` tokens from local color variables
- `dimension` tokens from local float variables
- `number` tokens from opacity float variables
- `fontWeight` tokens from font-weight float variables
- `typography` tokens from local text styles
- `shadow` tokens from local effect styles
- fallback color tokens from paint styles when color variables are unavailable

When variable collections are available, the default mode is exported to
`tokens.json`.
Every non-default mode is exported as `tokens.<mode>.json`, for example
`tokens.dark.json` or `tokens.brand-a.json`.

## Token Naming

Use `/` in Figma variable and style names to define the token path.
Explicit token layers are preserved:

- `Primitive/Color/Blue/500` -> `primitive.color.blue.500`
- `Semantic/Color/Action/Primary` -> `semantic.color.action.primary`
- `Component/Button/Primary/Bg` -> `component.button.primary.bg`

When the layer is omitted, the exporter applies a fallback prefix:

- color variables and paint styles -> `primitive.color`
- opacity variables -> `primitive.opacity`
- font-weight variables -> `primitive.font-weight`
- text styles -> `component.typography`
- effect styles -> `component.shadow`

Dimension variables use the Figma scope or name to infer the fallback group:

- `GAP` -> `primitive.spacing`
- `CORNER_RADIUS` -> `primitive.radius`
- `WIDTH_HEIGHT` -> `primitive.size`
- `STROKE_FLOAT` -> `primitive.border.width`

Name segments are normalized to lowercase kebab-case.
Empty names and incomplete explicit layer paths, such as `Primitive`, are
skipped and reported as warnings.

## Aliases

Variable aliases are exported as DTCG references only when the target is another
local variable of the same token type and has a valid token path.

Examples:

- `Semantic/Color/Action/Primary` -> `{primitive.color.blue.500}`
- `Semantic/Spacing/Md` -> `{primitive.spacing.4}`

Aliases are not inferred by matching raw values.
Unresolvable aliases are skipped and reported as warnings.


