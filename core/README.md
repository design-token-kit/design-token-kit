# @design-token-kit/core

The core package of Design Token Kit provides the runtime foundation
for working with [DTCG 2025.10 design tokens][dtcg] and [DESIGN.md][designmd].
It defines the typed token model, performs schema and semantic validation,
converts tokens into CSS custom properties and Tailwind CSS v4 theme output,
renders static HTML showcases, and builds token statistics reports.

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
  DtcgChecker,
  DtcgTokenCssConverter,
  createTokenHtmlShowcase,
  createTokenStats,
} from "@design-token-kit/core";

const sources = ["./tokens.json", "./tokens.dark.yaml"];

const issues = await new DtcgChecker().validate(sources);
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
and theme override selectors.

## Output Formats

### CSS custom properties

Generate token sets as CSS variables with a `:root` block for base
tokens and `:root[data-theme="<theme>"]` blocks for theme overrides.

### Tailwind CSS v4 theme output

Generate Tailwind CSS v4 theme variables with an `@theme` block for the
base token set and CSS selectors for theme overrides.

### HTML showcase

Render a static HTML preview from DTCG JSON, HRDT YAML, DESIGN.md, or
existing CSS.

### Token statistics

Build a text report or collect data for an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON, HRDT YAML, and DESIGN.md, or
write a parsed document back to any supported source format.

## Main APIs

* `DtcgChecker` - validate token sources with the full check pipeline
* `DtcgSchemaValidator` - validate DTCG JSON against the schema only
* `HrdtTokenValidator` - validate HRDT YAML token sources
* `DtcgListLoader` - load base and theme sources into a `DtcgList`
* `DtcgJsonReader` / `HrdtTokenReader` / `DesignMdReader` - parse supported token formats
* `DtcgJsonWriter` / `HrdtTokenWriter` / `DesignMdWriter` - export token documents
* `DtcgToDesignMdMapper` - map DTCG tree to flat DESIGN.md layout
* `DtcgTokenCssConverter` - generate CSS custom properties from tokens
* `DtcgTailwindCssConverter` - generate Tailwind CSS v4 `@theme` output
* `createTokenCssConverter()` - create the default CSS converter
* `createTailwindCssConverter()` - create the default Tailwind converter
* `createTokenHtmlShowcase()` - generate an HTML preview from token
  sources or CSS
* `createTokenStats()` - generate token statistics reports

## Validation

Use `DtcgChecker` when you want the full validation pass:

- format/schema checks for DTCG JSON, HRDT YAML, and DESIGN.md
- semantic checks on the resolved token graph
- optional lint checks when `scope` includes `CheckScope.LINT`

```ts
import { DtcgChecker } from "@design-token-kit/core";

const issues = await new DtcgChecker().validate([
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
HRDT YAML, and DESIGN.md.

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

- `@import 'tailwindcss';`
- `@theme { ... }` for Tailwind v4 theme variables
- `:root { ... }` as a plain custom-property mirror of the base tokens
- `[data-theme="<theme>"] { ... }` for theme overrides

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

### Tailwind CSS v4 output contract

`DtcgTailwindCssConverter` emits a documented Tailwind contract instead of
trying to map every DTCG token type into a new namespace.

Current mappings:

- `color` -> `--color-*`
- `dimension` -> `--spacing-*`, `--breakpoint-*`, or `--radius-*`
- `fontFamily` -> `--font-*`
- `fontWeight` -> `--font-weight-*`
- `shadow` -> `--shadow-*`
- `gradient` -> `--background-image-*`
- `duration` -> `--duration-*`
- `cubicBezier` -> `--ease-*`
- `typography` -> flattened into `--font-*`, `--text-*`,
  `--font-weight-*`, `--tracking-*`, `--leading-*`
- `transition` -> flattened into `--duration-*` and `--ease-*`

Tailwind-specific behavior:

- opaque `srgb` colors -> hex
- translucent `srgb` colors -> `rgb(... / ...)`
- other color spaces -> native CSS syntax

#### Breakpoints

DTCG does not define `breakpoint` as a separate token type, so Tailwind
breakpoints are derived from `dimension` tokens.

Resolution order:

1. `$extensions["design-token-kit"].tailwindNamespace`
2. path segments `breakpoint`, `breakpoints`, `screen`, `screens`
3. fallback to `--spacing-*`

Currently, the only supported explicit `tailwindNamespace` value is
`"breakpoint"`.

#### Limitations

- `border` composite tokens are not emitted as Tailwind theme variables
- `transition.delay` is not emitted in Tailwind output

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

The showcase pipeline accepts DTCG JSON, HRDT YAML, DESIGN.md, and existing
CSS sources. CSS input may be classic `:root` custom-property output or
Tailwind CSS v4 output with `@theme` and theme override selectors.

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

Token statistics work with DTCG JSON, HRDT YAML, and DESIGN.md sources.

## Links

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
[designmd]: https://github.com/google-labs-code/design.md
