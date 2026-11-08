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
- audits the text of the current page or the whole file for contrast, and its
  layers for hard-coded values and primitive variables,
  and selects the layers it reports
- keeps raw Plugin API and REST API JSON exports for diagnostics

## Scripts

- `npm run build` - build the production plugin bundle for publication
- `npm run build:development` - build a local plugin bundle without Mixpanel
  requests
- `npm run lint` - run ESLint
- `npm run test` - build a test bundle without Mixpanel requests and run Vitest
  tests
- `npm run watch` - rebuild the development bundle on file changes

All build modes write to `.figma-build/code.js`, so the last build command wins.
Use only `npm run build` before publishing. Use `npm run build:development`
before loading the plugin locally in Figma. Do not use the production build for
manual development testing, because it sends test activity to Mixpanel.

## Mixpanel Analytics

The plugin sends pseudonymous usage events through the Mixpanel Track API.
It disables IP geolocation and never sends token contents, file names, node
names, or Figma access tokens.

The public project token is configured in `ui.html` as
`MIXPANEL_PROJECT_TOKEN`.
The manifest allows requests to `https://api-js.mixpanel.com`.

The token is intentionally client-side because a Mixpanel project token only
identifies the destination project and is intended for untrusted clients.

The random anonymous installation identifier is created by the plugin code and
stored with `figma.clientStorage`, which is scoped by Figma to the current user
and plugin ID. It is not derived from a Figma file or personal information.

Production builds send events with `analytics_environment: production`.
Development and test builds disable Mixpanel requests.

Tracked events are `plugin_opened`, `token_analysis_started`,
`tokens_analyzed`, `design_audit_started`, `design_audit_completed`,
`tokens_exported`, and `file_exported`.
The export event records that the plugin started an export, not that the user
completed or accepted the browser download.
The initial token analysis and design audit run automatically for the UI, but
their start and completion events are sent only after a user action.

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

## Design Audit

The **Design** tab audits the text layers of the current page, or of every page
with **Entire file**, for automated WCAG text contrast by using the same
contrast rules as `@design-token-kit/core` (see `dtokens audit`):

- **Text contrast is below WCAG AA** (error): contrast with the background
  below 4.5:1, or 3:1 for large text (24px, or 18.66px bold).
It also audits whether the layers are built from tokens:

- **Values are not bound to variables** (warning): fills, strokes, radii, gaps,
  paddings and font sizes that are hard-coded, with the local variable or style
  that has the same or a close value.
- **Layers use primitive variables directly** (warning): properties bound to a
  `primitive` variable where `semantic` ones exist.
- **Token coverage**: the share of these properties bound to a variable or a
  style.

Each category has its own score from 0 to 100 with an A-F grade. Neither is a
WCAG conformance level; only text contrast is a WCAG criterion.

The token usage audit reports two warnings:

- **Values are not bound to variables** (`hardcoded-value`): a color, spacing,
  radius, or font size is hard-coded instead of bound to a variable or style.
- **Layers use primitive variables directly** (`primitive-binding`): a property
  is bound to a primitive variable while a higher-layer token is available.

The token usage score is separate from the accessibility score.
It is the share of audited properties without a token usage finding.

Text on a gradient or an image, and text with several colours, is listed under
**Not checked** and does not affect the score. **Select** selects a layer in
Figma and zooms to it. The audit is read-only: it never changes the file.

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

Use a separate path segment for a palette scale, for example
`Primitive/Color/Blue/500` rather than `Primitive/Color/Blue-500`.
The latter remains exportable, but does not use the canonical palette structure.

When the layer is omitted, the exporter applies a fallback prefix:

- color variables and paint styles -> `primitive.color`
- opacity variables -> `primitive.opacity`
- font-weight variables -> `primitive.font-weight`
- text styles -> `primitive.typography`
- effect styles -> `primitive.shadow`

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

## Reference provenance extension

When a Figma colour is composed from aliases to individual color properties, the
exporter preserves the original aliases in the DTCG token's `$extensions`:

```json
{
  "$extensions": {
    "io.github.design-token-kit": {
      "referenceSources": {
        "#/primitive/color/blue/$value/colorSpace": "{semantic.color.action}"
      }
    }
  }
}
```

The `referenceSources` object maps a DTCG property reference in `$value` to the
original token alias exported from Figma. Its keys are JSON Pointers and its
values are DTCG curly-brace token references.

This metadata is needed when the property reference points to a resolved source
property but the original Figma alias points to a different token layer. Core's
`layer-reference` check reads it to preserve the architecture of the Figma
alias graph. The CLI therefore uses the same result when checking the exported
file.

The extension is optional. DTCG readers that do not know it can ignore the
vendor-specific namespace and still read the token value.
