# @design-token-kit/core

The core package of Design Token Kit provides the runtime foundation
for working with [DTCG 2025.10 design tokens][dtcg]. It defines the
typed token model, performs schema and semantic validation, converts
tokens into CSS custom properties, renders static HTML showcases, and
builds token statistics reports.

## Features

* **[DTCG 2025.10 validation][dtcg]** - schema validation for DTCG JSON token
  documents
* **Semantic checks** - unresolved references, circular references,
  group references, type mismatches, and deprecated token usage
* **[HRDT YAML support][hrdt]** - a compact, human-readable alternative to
  DTCG JSON
* **Token format conversion** - read and write DTCG JSON and HRDT YAML
* **CSS generation** - base and theme token sets rendered as CSS
  custom properties
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

### Base and theme sources

When multiple token sources are provided, the first source is treated
as the base token set and the remaining sources are treated as theme
overrides.

### CSS input for showcase

For showcase generation, a single CSS source can be rendered directly
without going through token validation.

## Output Formats

### CSS custom properties

Generate token sets as CSS variables with a `:root` block for base
tokens and `:root[data-theme="<theme>"]` blocks for theme overrides.

### HTML showcase

Render a static HTML preview from DTCG JSON, HRDT YAML, or existing
CSS custom properties.

### Token statistics

Build a text report or collect data for an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON and HRDT YAML, or write a
parsed document back to either source format.

## Main APIs

* `DtcgTokenValidator` - validate DTCG JSON and HRDT YAML token sources
* `DtcgListLoader` - load base and theme sources into a `DtcgList`
* `DtcgJsonReader` / `HrdtTokenReader` - parse supported token formats
* `DtcgJsonWriter` / `HrdtTokenWriter` - export token documents
* `DtcgTokenCssConverter` - generate CSS custom properties from tokens
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

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
