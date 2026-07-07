# @design-token-kit/core

The core package of Design Token Kit provides the runtime foundation
for working with [DTCG 2025.10 design tokens][dtcg] and [DESIGN.md][designmd].
It defines the typed token model, performs schema and semantic validation,
converts tokens into CSS custom properties, renders static HTML showcases,
and builds token statistics reports.

GitHub repository:
https://github.com/design-token-kit/design-token-kit

## Features

* **[DTCG 2025.10 validation][dtcg]** - schema validation for DTCG JSON token
  documents
* **Semantic checks** - unresolved references, circular references,
  group references, type mismatches, and deprecated token usage
* **Lint checks** - cross-layer references, raw value placement, empty groups,
  and missing token descriptions
* **[HRDT YAML support][hrdt]** - a compact, human-readable alternative to
  DTCG JSON
* **[DESIGN.md support][designmd]** -
  read and write the markdown-based format with YAML frontmatter
* **Token format conversion** - read and write DTCG JSON, HRDT YAML, and
  DESIGN.md
* **CSS generation** - base and theme token sets rendered as CSS
  custom properties or Tailwind CSS v4 `@theme` variables
* **Static showcase** - HTML showcase generation from token sources or
  existing CSS
* **Token stats** - text and HTML statistics reports for token sources
* **Source abstraction** - local files, stdin, URLs, and raw token
  content strings

Node.js 18 or newer is required.

## Install

```bash
npm install @design-token-kit/core
```

## Quick Start

```ts
import {
  DtcgListLoader,
  DtcgTokenValidator,
  DtcgTokenCssConverter,
  createTokenHtmlShowcase,
  createTokenStats,
} from "@design-token-kit/core";

const sources = ["./tokens.json", "./tokens.dark.yaml"];

const issues = await new DtcgTokenValidator().validate(sources);
if (issues.some((issue) => issue.severity === "error")) {
  console.error(issues);
  process.exit(1);
}

const list = await new DtcgListLoader().load(sources);
const css = new DtcgTokenCssConverter().convertList(list);
const html = await createTokenHtmlShowcase().showcase(sources);
const stats = await createTokenStats().stats(sources);

console.log(css);
console.log(html.slice(0, 120));
console.log(stats);
```

## Input Formats

### DTCG JSON

Use DTCG JSON token documents as the canonical source format for
validation, conversion, and showcase generation.

### HRDT YAML

Use HRDT YAML for a more compact, human-readable authoring format. HRDT
documents are parsed into the same internal `Dtcg` model as DTCG JSON.

### DESIGN.md

Read DESIGN.md files using `DesignMdReader`. The YAML frontmatter is
parsed into the internal `Dtcg` model. `DtcgToDesignMdMapper` flattens
DTCG token trees (`primitive`/`semantic`/`component`) into the flat
DESIGN.md layout (`colors`/`typography`/`rounded`/`spacing`/`components`).
Write DESIGN.md output with `DesignMdWriter`.

### Base and theme sources

When multiple token sources are provided, the first source is treated
as the base token set and the remaining sources are treated as theme
overrides.

### CSS input for showcase

For showcase generation, a single CSS source can be rendered directly
without going through token validation. This includes both classic
`:root` custom-property output and Tailwind CSS v4 output with `@theme`
and `[data-theme="..."]` overrides.

## Output Formats

### CSS custom properties

Generate token sets as CSS variables with a `:root` block for base
tokens and `:root[data-theme="<theme>"]` blocks for theme overrides.

### Tailwind CSS v4 theme output

Generate Tailwind CSS v4 theme variables with an `@theme` block for the
base token set and `[data-theme="<theme>"]` overrides for additional
themes.

### HTML showcase

Render a static HTML preview from DTCG JSON, HRDT YAML, or existing
CSS custom properties.

### Token statistics

Build a text report or collect data for an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON, HRDT YAML, and DESIGN.md, or
write a parsed document back to any supported source format.

## Main APIs

* `DtcgTokenValidator` - validate DTCG JSON and HRDT YAML token sources
* `DtcgListLoader` - load base and theme sources into a `DtcgList`
* `DtcgJsonReader` / `HrdtTokenReader` / `DesignMdReader` - parse supported token formats
* `DtcgJsonWriter` / `HrdtTokenWriter` / `DesignMdWriter` - export token documents
* `DtcgToDesignMdMapper` - map DTCG tree to flat DESIGN.md layout
* `DtcgTokenCssConverter` - generate CSS custom properties from tokens
* `DtcgTailwindCssConverter` - generate Tailwind CSS v4 `@theme` output
* `createTokenHtmlShowcase()` - generate an HTML preview from token
  sources or CSS
* `createTokenStats()` - generate token statistics reports

## Validation

Use `DtcgTokenValidator` when you want the full validation pass:

- DTCG schema checks
- HRDT schema checks
- semantic checks on the resolved token graph

```ts
import { DtcgTokenValidator } from "@design-token-kit/core";

const issues = await new DtcgTokenValidator().validate([
  "./tokens.json",
  "./tokens.dark.json",
]);

for (const issue of issues) {
  console.log(
    issue.severity,
    issue.sourcePath,
    issue.tokenPath,
    issue.message,
  );
}
```

Use `DtcgSchemaValidator` when you only need DTCG schema validation
without semantic checks.

## Document Conversion

Use readers and writers to convert token documents between DTCG JSON
and HRDT YAML.

```ts
import {
  DtcgJsonReader,
  HrdtTokenWriter,
} from "@design-token-kit/core";

const doc = new DtcgJsonReader().parse(jsonString);
const yaml = new HrdtTokenWriter().write(doc);
```

## CSS Conversion

`DtcgTokenCssConverter` emits:

- base tokens under `:root`
- theme overrides under `:root[data-theme="<theme>"]`
- aliases as `var(--token-name)`

```ts
import { DtcgTokenCssConverter } from "@design-token-kit/core";

const css = await new DtcgTokenCssConverter().convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

When you already have a parsed document or a prepared `DtcgList`, use
`convertDocument()` or `convertList()` instead of reloading sources.

For Tailwind CSS v4 output, use `DtcgTailwindCssConverter`.

```ts
import { DtcgTailwindCssConverter } from "@design-token-kit/core";

const css = await new DtcgTailwindCssConverter().convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

Default Tailwind output contains:

- `@theme { ... }` for Tailwind v4 theme variables
- `:root { ... }` as a plain custom-property mirror of the base tokens
- `[data-theme="<theme>"] { ... }` for theme overrides

The `:root` mirror keeps the generated variables directly usable as regular CSS
custom properties, for example in arbitrary values such as
`bg-[var(--color-primary-500)]`.

For Shadow DOM or custom theming selectors, pass converter options:

```ts
import { DtcgTailwindCssConverter } from "@design-token-kit/core";

const css = await new DtcgTailwindCssConverter({
  baseSelector: ":host",
  themeSelector: ":host([data-theme='{theme}'])",
}).convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

Options:

- `baseSelector`: selector that receives the mirrored base custom properties.
  Defaults to `:root`. Use `:host` for Shadow DOM output.
- `themeSelector`: selector template for theme overrides. `{theme}` is replaced
  with the resolved theme name. Defaults to `[data-theme='{theme}']`.

### Tailwind dimension tokens and breakpoints

DTCG does not define `breakpoint` as a separate token type. In DTCG, both
spacing values and breakpoint values are represented as `dimension` tokens.

Tailwind, however, uses different theme variable namespaces:

```css
--spacing-md: 16px;
--breakpoint-3xl: 1920px;
```

Design Token Kit maps `dimension` tokens to Tailwind namespaces using the
following order:

1. If the token has an explicit Tailwind namespace in `$extensions`, that
   namespace is used.
2. If the token path contains `breakpoint`, `breakpoints`, `screen`, or
   `screens`, the token is emitted as `--breakpoint-*`.
3. Otherwise, `dimension` tokens are emitted as `--spacing-*`.

This is a Design Token Kit specific mapping for Tailwind output. It is not a
separate DTCG token type.

#### Explicit breakpoint marker

Use `$extensions["design-token-kit"].tailwindNamespace` when your token
structure does not use breakpoint-like group names.

Currently, the only supported explicit `tailwindNamespace` value is
`"breakpoint"`. Unsupported values are ignored by Tailwind conversion and
reported as warnings by the validation pipeline.

```json
{
  "layout": {
    "desktop": {
      "$type": "dimension",
      "$value": { "value": 1920, "unit": "px" },
      "$extensions": {
        "design-token-kit": {
          "tailwindNamespace": "breakpoint"
        }
      }
    }
  }
}
```

This produces:

```css
--breakpoint-layout-desktop: 1920px;
```

#### Naming convention fallback

For simple token files, breakpoint-like paths work without `$extensions`:

```json
{
  "breakpoint": {
    "3xl": {
      "$type": "dimension",
      "$value": { "value": 1920, "unit": "px" }
    }
  }
}
```

This produces:

```css
--breakpoint-3xl: 1920px;
```

Any other `dimension` token is treated as spacing by default:

```json
{
  "spacing": {
    "md": {
      "$type": "dimension",
      "$value": { "value": 16, "unit": "px" }
    }
  }
}
```

This produces:

```css
--spacing-md: 16px;
```

### Tailwind gradient tokens

Tailwind CSS treats gradients as `background-image` values rather than colors.
For Tailwind CSS v4 output, Design Token Kit maps DTCG `gradient` tokens to the
`--background-image-*` namespace.

```json
{
  "primitive": {
    "gradient": {
      "brand": {
        "$type": "gradient",
        "$value": [
          {
            "color": { "colorSpace": "srgb", "components": [0.063, 0.647, 0.647], "alpha": 1, "hex": "#10a5a5" },
            "position": 0
          },
          {
            "color": { "colorSpace": "srgb", "components": [0.118, 0.161, 0.231], "alpha": 1 },
            "position": 1
          }
        ]
      }
    }
  }
}
```

This produces:

```css
--background-image-primitive-brand: linear-gradient(180deg, #10a5a5 0%, #1e293b 100%);
```

Gradient aliases stay in the same namespace:

```css
--background-image-semantic-surface-brand: var(--background-image-primitive-brand);
```

This is a Design Token Kit specific Tailwind mapping. The generated variables
work with Tailwind background-image utilities such as `bg-brand`, and they are
also available as regular custom properties for arbitrary values.

### Tailwind transition tokens

Tailwind CSS v4 already has theme namespaces for transition duration and timing
function. For Tailwind output, Design Token Kit flattens DTCG `transition`
tokens into:

- `--duration-*` from `transition.duration`
- `--ease-*` from `transition.timingFunction`

The `delay` part of a DTCG `transition` token is not emitted in Tailwind output
at this stage.

```json
{
  "primitive": {
    "transition": {
      "emphasis": {
        "$type": "transition",
        "$value": {
          "duration": { "value": 240, "unit": "ms" },
          "delay": { "value": 80, "unit": "ms" },
          "timingFunction": [0.2, 0.8, 0.2, 1]
        }
      }
    }
  }
}
```

This produces:

```css
--duration-primitive-emphasis: 240ms;
--ease-primitive-emphasis: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Transition aliases are flattened the same way:

```css
--duration-semantic-emphasis: var(--duration-primitive-emphasis);
--ease-semantic-emphasis: var(--ease-primitive-emphasis);
```

## HTML Showcase

Use `createTokenHtmlShowcase()` for the default pipeline or
`TokenHtmlShowcaseBuilder` when you want to inject your own validator,
converter, parser, or renderer.

```ts
import { createTokenHtmlShowcase } from "@design-token-kit/core";

const html = await createTokenHtmlShowcase().showcase([
  "./tokens.yaml",
]);
```

## Token Statistics

Use `createTokenStats()` for the default text report or
`TokenStatsBuilder` / `TokenStatsHtmlRenderer` when you want to collect
data and render your own HTML page.

```ts
import { createTokenStats } from "@design-token-kit/core";

const stats = await createTokenStats().stats([
  "./tokens.yaml",
]);
```

## Links

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
[designmd]: https://github.com/google-labs-code/design.md
