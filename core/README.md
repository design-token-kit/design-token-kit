# @design-token-kit/core

[![Breaking changes in v3.0.0](https://img.shields.io/badge/Breaking_changes-v3.0.0-dc2626?style=flat-square)](https://design-token-kit.github.io/docs/migration/1.x-to-3.0/)

The core package of Design Token Kit provides the runtime foundation
for working with [DTCG 2025.10 design tokens][dtcg] and [DESIGN.md][designmd].
It defines the typed token model, performs schema and semantic validation,
converts tokens into CSS custom properties, SCSS variables,
Tailwind CSS v4 theme output, SwiftUI source, and Android resource XML,
renders static HTML showcases, and builds token statistics reports.

GitHub repository:
https://github.com/design-token-kit/design-token-kit

Website:
https://design-token-kit.github.io/

> **Breaking changes in v3.0.0:** Read the migration guide for your current
> version before upgrading: [1.x to 3.0](https://design-token-kit.github.io/docs/migration/1.x-to-3.0/),
> [1.x to 2.0](https://design-token-kit.github.io/docs/migration/1.x-to-2.0/), or
> [2.0 to 3.0](https://design-token-kit.github.io/docs/migration/2.0-to-3.0/).

## Features

* **[DTCG 2025.10 validation][dtcg]** - schema validation for DTCG JSON token
  documents
* **Semantic checks** - unresolved references, circular references,
  group references, type mismatches, and deprecated token usage
 * **Lint checks** - cross-layer references, raw value placement, empty groups,
   and optional missing token descriptions
* **Design audit** - WCAG text contrast of text and background color pairs,
  readable font sizes, and body text line heights, with a 0-100 score
* **[HRDT YAML support][hrdt]** - a compact, human-readable alternative to
  DTCG JSON
* **[DESIGN.md support][designmd]** -
  read and write the markdown-based format with YAML frontmatter
* **Token format conversion** - read and write DTCG JSON, HRDT YAML, and
  DESIGN.md
* **CSS generation** - base and theme token sets rendered as CSS
  custom properties, SCSS variables, or Tailwind CSS v4 `@theme` variables
* **SwiftUI generation** - base and theme token sets rendered as Swift source
  using nested enums or an additional `Theme` struct layer
* **Android generation** - base and theme token sets rendered as `res/values`
  resource XML split by resource type
* **Static showcase** - HTML showcase generation from token sources or
  existing CSS, with color format selection and copy controls
* **Token stats** - text and HTML statistics reports for token sources
* **Source abstraction** - local files, stdin, URLs, and raw token
  content strings

Node.js 20.19.0 or newer is required.

## Install

```bash
npm install @design-token-kit/core
```

## Quick Start

```ts
import {
  DtcgListLoader,
  TokenChecker,
  CssTokenConverter,
  ScssTokenConverter,
  SwiftUiTokenConverter,
  AndroidTokenConverter,
  createTokenHtmlShowcase,
  createTokenStats,
} from "@design-token-kit/core";

const sources = ["./tokens.json", "./tokens.dark.yaml"];

const issues = await new TokenChecker().check(sources);
if (issues.some((issue) => issue.severity === "error")) {
  console.error(issues);
  process.exit(1);
}

const list = await new DtcgListLoader().load(sources);
const css = new CssTokenConverter().convertList(list);

console.log(css);
```

For validation, other output formats, showcase generation, and token
statistics, see the sections below.

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

### SCSS variables

Generate token sets as SCSS variables.
Token hierarchy is flattened into variable names by replacing `.` in token
paths, aliases are emitted as SCSS variable references, and the separator is
configurable.

Single-document output is returned as one stylesheet.
Multi-theme output is returned as one stylesheet per theme. In the CLI this can
then be packaged either as a tar archive or as separate `.scss` files,
depending on the selected `--out` contract.

### Tailwind CSS v4 theme output

Generate Tailwind CSS v4 theme variables with an `@theme` block for the
base token set and CSS selectors for theme overrides.

### SwiftUI source

Generate Swift source from token sets.
The default output is a nested enum API.
The optional struct output adds a `Theme` value layer on top of the enum layer.

### Android resource XML

Generate Android resource files from token sets.
Resources are split by root token group, mirroring the token hierarchy, or by
Android resource type. Themes are written to qualified resource directories.

### HTML showcase

Render a static HTML preview from DTCG JSON, HRDT YAML, DESIGN.md, or
existing CSS.

Color cards expose the source CSS value and, when conversion is supported, HEX,
RGBA, and HSLA values. Each displayed value can be copied from the generated
page.

### Token statistics

Build a text report or collect data for an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON, HRDT YAML, and DESIGN.md, or
write a parsed document back to any supported source format.

## Main APIs

* `TokenChecker` - check token sources with the full pipeline
* `TokenAuditor` - audit the design quality of token sources: text contrast
  and readability
* `auditTextSamples()` - apply the audit rules to text samples from any source
* `TokenTextSampler` - build the text samples a token set implies
* `auditUsageSamples()` - audit whether design properties are bound to tokens
* `TokenMatcher` - find exact or close token matches for usage samples
* `computeTokenCoverage()` / `computeTokenUsageScore()` - measure token usage
* `contrastRatio()`, `minimumContrast()`, `isLargeText()`, `toSrgbColor()` -
  WCAG contrast helpers
* `DtcgListLoader` - load base and theme sources into a `DtcgList`
* `tokenFormats` - the registry of readable formats
* `FormatDescriptor` - everything one format declares: suffixes, detection, reader, writer
* `TokenFileName` - read `<role>[.theme].<format>` from a file name
* `DtcgReader` / `HrdtReader` / `DesignMdReader` - read supported token formats
* `DtcgWriter` / `HrdtWriter` / `DesignMdWriter` - export token documents
* `DtcgToDesignMdMapper` - map DTCG tree to flat DESIGN.md layout
* `TokenConverter` - common interface for platform converters
* `CssTokenConverter` - generate CSS custom properties from tokens
* `ScssTokenConverter` - generate SCSS variables from tokens
* `TailwindTokenConverter` - generate Tailwind CSS v4 `@theme` output
* `SwiftUiTokenConverter` - generate SwiftUI source from tokens
* `AndroidTokenConverter` - generate Android resource XML from tokens
* `CssColorValueConverter` - convert color values to CSS color syntax
* `SwiftUiColorValueConverter` - convert color values to SwiftUI expressions
* `AndroidColorValueConverter` - convert color values to Android `#AARRGGBB`
* `AndroidDimensionValueConverter` - convert dimension values to Android
  `dp` and `sp` literals
* `AndroidLayerLayout`, `AndroidTypeLayout` - split Android resources across
  files by token group or by resource type
* `ScssTokenOutput` - one generated SCSS stylesheet output
* `AndroidTokenOutput` - one generated Android resource file
* `createCssTokenConverter()` - create the default CSS converter
* `createScssTokenConverter()` - create the default SCSS converter
* `createTailwindTokenConverter()` - create the default Tailwind converter
* `createTokenHtmlShowcase()` - generate an HTML preview from token
  sources or CSS
* `createTokenStats()` - generate token statistics reports

Deprecated compatibility aliases are still exported for older consumers.
Prefer the primary names in new code.

* `DtcgTokenCssConverter` -> `CssTokenConverter`
* `DtcgTokenScssConverter` -> `ScssTokenConverter`
* `DtcgTailwindCssConverter` -> `TailwindTokenConverter`
* `ColorCssSerializer` -> `CssColorValueConverter`
* `TokenScssOutput` -> `ScssTokenOutput`
* `createTokenCssConverter()` -> `createCssTokenConverter()`
* `createTokenScssConverter()` -> `createScssTokenConverter()`
* `createTailwindCssConverter()` -> `createTailwindTokenConverter()`

Other compatibility aliases are still exported but are not deprecated by this
migration:

* `DtcgTokenSwiftUiConverter` -> `SwiftUiTokenConverter`
* `ColorSwiftUiSerializer` -> `SwiftUiColorValueConverter`

The package exports a single entry point, so both names are imported from the
package root:

```ts
import type { ScssTokenOutput, TokenScssOutput } from "@design-token-kit/core";
```

Use the primary name in new code:

```ts
import type { ScssTokenOutput } from "@design-token-kit/core";
```

## Validation

Use `TokenChecker` when you want the full pass:

- format/schema checks for DTCG JSON, HRDT YAML, and DESIGN.md, reported by
  the format's own reader
- semantic checks on the resolved token graph
- optional lint checks when `scope` includes `CheckScope.LINT`

```ts
import { TokenChecker } from "@design-token-kit/core";

const issues = await new TokenChecker().check([
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

Use `checkReport()` when the caller also needs the token architecture score.
The score is the percentage of checks that ran and passed; warnings and errors
count equally as failed checks.
An unreadable source or a fail-fast pipeline that skips checks has no score.
The report lists skipped check ids in `notChecked`.

```ts
const report = await new TokenChecker().checkReport(["./tokens.json"]);

if (report.score !== undefined) {
  console.log(`${report.score.score}/100 (${report.score.grade})`);
}
```

Format and schema errors come from the reader itself, so a source that fails
them yields no document at all - a half-built model would make every reference
into it look broken. Use `CheckScope` to run only the checks you want on top.

## Design Audit

Use `TokenAuditor` to learn whether the design a token set describes is
accessible and readable. `TokenChecker` tells whether tokens are valid;
`TokenAuditor` tells whether text set with them can be read.

```ts
import { TokenAuditor } from "@design-token-kit/core";

const result = await new TokenAuditor({ level: "AA" }).audit([
  "./tokens.json",
  "./tokens.dark.json",
]);

if (result.ok) {
  const { findings, unchecked, score } = result.report;
  for (const finding of findings) {
    console.log(finding.id, finding.severity, finding.theme ?? "base", finding.message);
  }
  console.log(score !== undefined
    ? `${unchecked.length} not checked, score ${score.score} (${score.grade})`
    : `${unchecked.length} not checked, score unavailable`);
}
```

Rules:

* `text-contrast` (error) - contrast below the WCAG 2.2 AA minimum: 4.5:1 for
  normal text, 3:1 for large text. With `level: "AAA"`, text that meets AA but
  not AAA is a warning.
* `text-size` (warning) - text below `minFontSizePx`, 12 by default.
* `line-height` (warning) - text below `headingSizePx` (18 by default) whose
  line height is below `minBodyLineHeight` (1.3 by default).

`TokenTextSampler` turns a token set into text samples: pairs of a text and a
background color, matched by name (`text-*` with `background-*`, `bg-*`,
`surface-*` or `canvas-*` in the same group, `on-X` with `X`), and typography
tokens. Each theme is sampled over the base set and keeps only what it changes.
Pairs on a translucent background are returned as `unchecked` and do not
affect the score. When every sample is unchecked, the score is unavailable.

The score is `100 - 2 x errors - 0.1 x warnings`, rounded and never below 0,
graded A (90+), B (80-89), C (70-79), D (60-69) or F. `scoreWeights` changes
the weights.

The rules do not depend on tokens. Any source that can describe its text - a
Figma text node, for instance - can be audited with `auditTextSamples()`:

```ts
import { auditTextSamples } from "@design-token-kit/core";

const { findings } = auditTextSamples([{
  id: "1:23",
  label: "Card / Caption",
  foreground: { red: 0.63, green: 0.64, blue: 0.67, alpha: 1 },
  background: { red: 1, green: 1, blue: 1, alpha: 1 },
  fontSizePx: 11,
  fontWeight: 400,
  lineHeight: 1.2,
}], { level: "AA" });
```

## Token Usage Audit

Use `auditUsageSamples()` to check whether design properties are built from
tokens.
The audit is source-independent, so Figma adapters and other integrations can
provide the samples.

It reports two warnings:

* `hardcoded-value` - a color, spacing, radius, or font size is not bound to a
  token and may have an exact or close token suggestion
* `primitive-binding` - a property is bound to the lowest layer while a token
  from a higher layer exists

The result includes token coverage and a separate usage score.
Token usage does not affect the accessibility score.
The public API expects `UsageSample` values and `TokenCandidate` values from the
integration that is being audited.

## Browser API

> **Experimental.** The browser entry point is built for the Design Token Kit
> website and may change in minor releases. Pin an exact version if you
> depend on it.

See the [Browser API guide on the website](https://design-token-kit.github.io/docs/core/browser-api/)
for installation and integration instructions.

Use the browser entry point for local, in-memory token content.
It bundles the DTCG, HRDT, and DESIGN.md schemas and never accesses paths,
stdin, or temporary files.

```ts
import {
  BrowserTokenToolkit,
  CheckScope,
  PlatformFormat,
  TokenFormat,
} from "@design-token-kit/core/browser";

const toolkit = new BrowserTokenToolkit();
const input = {
  base: {
    source: "tokens.json",
    format: TokenFormat.DTCG,
    content: await file.text(),
  },
};

const issues = toolkit.check(input, { scope: CheckScope.LINT });
const css = toolkit.convert(input, PlatformFormat.CSS)[0]?.content;
```

The browser entry accepts DTCG JSON, HRDT YAML, and DESIGN.md input.
It supports all built-in conversion formats, HTML showcase generation, and
token statistics.
For browser security and compatibility, URL loading is owned by the host app
and depends on the source server's CORS policy.

Optional `themes` map names to override documents.
Theme names may contain letters, numbers, hyphens, and underscores.
The name `base` is reserved for the base document.
If `source` is omitted, diagnostics use `browser-input` for the base document
and the map key for a theme.

`check()` respects the `scope` and `checks` options.
The `missing-description` check is opt-in and must be included in `checks` when
you want to run it.
`convert()` and `stats()` always run all schema and model checks, regardless
of those options, and throw `BrowserTokenValidationError` on errors.
Its `issues` property contains the diagnostics.
Conversion also rejects duplicate output paths, such as Android themes
`dark` and `night` both mapping to `values-night`.

Schema validation uses AJV, which compiles schemas into functions at
runtime. A page with a Content Security Policy must allow `'unsafe-eval'`
in `script-src`, or validation fails. Compiled schemas are cached per page,
so only the first check pays the compilation cost.

## Document Conversion

Use readers and writers to convert token documents between DTCG JSON,
HRDT YAML, and DESIGN.md.

A reader validates its own format and returns a result rather than throwing.
The result is a tagged union: `ok` says whether the source was read,
`documents` lives on the branch where it was, and `issues` on the branch where
it was not - so the compiler will not let you reach for either until you have
checked. Every diagnostic a reader records stops the read, so a successful one
has nothing left to report.

```ts
import {
  DtcgReader,
  HrdtWriter,
} from "@design-token-kit/core";

const reader = await DtcgReader.create();
const result = reader.read(jsonString);
if (!result.ok) {
  console.error(result.issues);
  process.exit(1);
}

const yaml = new HrdtWriter().write(result.documents[0]);
```

Building the reader is asynchronous because it reads the schema from disk,
once. Reading a document afterwards is synchronous. `DtcgReader.create` also
takes a built-in schema name or a path to one of your own.

To read without a schema - checking the token model but not the document
structure - use `DtcgReader.noSchema()`. That is what the browser entry and
the Figma plugin do, having no file system to read a schema from.

To pick the format at run time rather than naming the reader, ask the
registry:

```ts
import { tokenFormats, TokenFormat } from "@design-token-kit/core";

const reader = await tokenFormats.get(TokenFormat.HRDT).createReader();
const result = reader.read(yamlString);
```

## CSS Conversion

`CssTokenConverter` emits:

- base tokens under `:root`
- theme overrides under `:root[data-theme="<theme>"]`
- aliases as `var(--token-name)`

```ts
import { CssTokenConverter } from "@design-token-kit/core";

const css = await new CssTokenConverter().convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

When you already have a parsed document or a prepared `DtcgList`, use
`convertDocument()` or `convertList()` instead of reloading sources.

## SCSS Conversion

`ScssTokenConverter` emits:

- flattened SCSS variable names that preserve token hierarchy
- aliases as SCSS variable references
- configurable separators that replace `.` in token paths

```ts
import { ScssTokenConverter } from "@design-token-kit/core";

const scss = await new ScssTokenConverter().convert([
  "./tokens.json",
]);
```

Examples:

- `primitive.color.brand` -> `$primitive-color-brand`
- with separator `_`: `primitive.color.brand` -> `$primitive_color_brand`

For multiple token sources, use separate per-theme outputs:

```ts
import { ScssTokenConverter } from "@design-token-kit/core";

const outputs = await new ScssTokenConverter().convertThemes([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

This returns one stylesheet per theme:

- `base`
- `dark`
- any additional theme names derived from source file names

Theme names come from source file names, read as `<role>[.theme].<format>`:

- `tokens.json` -> base document
- `tokens.dark.json` -> `dark`
- `showcase.dark.dtcg.json` -> `dark`
- `sample.dark.design.md` -> `dark`

The format segment is optional - an extension already names the format while
only one format claims it. Each format declares both forms, so `.json` and
`.dtcg.json` are equally understood; spell the format out when a directory
holds the same tokens in several formats. A segment no format declares is a
theme like any other word, so `tokens.super_dtcg.json` yields theme
`super_dtcg`.

DESIGN.md is read from `.md` and from the compound `.design.md`. The latter is
this project's own convention: the specification names only `DESIGN.md` and
says nothing about themes or multiple files.

A source with no theme segment is named by its role, so several base documents
in one list stay apart.

Use `convertList()` only for a single-document SCSS result. If the list
contains themes, use `convertThemeList()` instead.

For Tailwind CSS v4 output, use `TailwindTokenConverter`.

```ts
import { TailwindTokenConverter } from "@design-token-kit/core";

const css = await new TailwindTokenConverter().convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

Default Tailwind output contains:

- `@import 'tailwindcss';`
- `@theme { ... }` for Tailwind v4 theme variables
- `[data-theme="<theme>"] { ... }` for theme overrides

If you also need a plain custom-property mirror for Shadow DOM or another
runtime CSS integration, pass converter options:

```ts
import { TailwindTokenConverter } from "@design-token-kit/core";

const css = await new TailwindTokenConverter({
  baseSelector: ":host",
  themeSelector: ":host([data-theme='{theme}'])",
}).convert([
  "./tokens.json",
  "./tokens.dark.json",
]);
```

### Tailwind CSS v4 output contract

`TailwindTokenConverter` emits a documented Tailwind contract instead of
trying to map every DTCG token type into a new namespace.

Current mappings:

- `color` -> `--color-*`
- `dimension` -> `--spacing-*`, `--breakpoint-*`, `--radius-*`,
  `--text-*`, or `--tracking-*` depending on token naming
- `fontFamily` -> `--font-*`
- `fontWeight` -> `--font-weight-*`
- `number` -> `--font-weight-*` or `--leading-*` when token naming matches
- `shadow` -> `--shadow-*`
- `gradient` -> `--background-image-*`
- `duration` -> `--duration-*`
- `cubicBezier` -> `--ease-*`
- `typography` -> flattened into `--font-*`, `--text-*`,
  `--text-*--line-height`, `--text-*--letter-spacing`,
  and `--text-*--font-weight`
- `transition` -> flattened into `--duration-*` and `--ease-*`

Tailwind-specific behavior:

- opaque `srgb` colors -> hex
- translucent `srgb` colors -> `rgb(... / ...)`
- other color spaces -> native CSS syntax
- font-weight keywords such as `regular`, `book`, and `bold` -> numeric CSS
  weights such as `400`, `400`, and `700`

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
- `dimension` tokens named like border widths are currently skipped instead of
  being mapped to an undocumented Tailwind namespace
- `transition.delay` is not emitted in Tailwind output

## SwiftUI Conversion

Use `SwiftUiTokenConverter` to generate Swift source from a parsed document
or a base document with theme overrides.

```ts
import { SwiftUiTokenConverter } from "@design-token-kit/core";

const swift = new SwiftUiTokenConverter().convertList(list);
```

The default `enum` output emits nested enums and `static let` members.
References are preserved as Swift constant paths.
Numeric token path segments receive an underscore prefix, so
`primitive.color.brand.500` becomes
`DesignTokens.Primitive.Color.Brand._500`.
For this palette shape, the generated enum also exposes the compatibility alias
`DesignTokens.Primitive.Color.brand500`.

```ts
import { SwiftUiTokenConverter } from "@design-token-kit/core";

const swift = new SwiftUiTokenConverter({ swiftType: "struct" })
  .convertList(list);
```

The `struct` output keeps the enum layer and adds a `Theme` struct with
theme instances.
Use it when consuming tokens through value objects is more convenient than
referencing enum constants directly.
It also exposes the palette compatibility alias as a computed property, for
example `Themes.base.primitive.color.brand500`.

### Dimensions

SwiftUI has no `rem` unit. The DTCG specification names `pt` as the iOS
equivalent of `px`, so `px` dimensions are emitted as is, while `rem`
dimensions are resolved to an absolute value against a pixel base. This
applies to scalar `dimension` tokens and to composite fields such as
`fontSize`, `letterSpacing`, shadow blur and offsets, and border width.

```ts
import { SwiftUiTokenConverter } from "@design-token-kit/core";

const swift = new SwiftUiTokenConverter({ remBase: 10 }).convertList(list);
```

Base resolution order:

1. the `remBase` option
2. `$extensions["design-token-kit"].remBase` on the document root
3. fallback to `16`

The option belongs to the target platform, the extension to the design
system, so an explicit option always wins. An unusable extension value is
ignored in favor of the default and reported by the `bad-rem-base` check.

## Android Conversion

Use `AndroidTokenConverter` to generate Android resource XML from a parsed
document or a base document with theme overrides.

Android output spans several files, so `convertResourceList()` returns one
output per resource file, each carrying its path relative to the Android
resource root.

```ts
import { AndroidTokenConverter } from "@design-token-kit/core";

const outputs = new AndroidTokenConverter().convertResourceList(list);

for (const output of outputs) {
  // output.filePath - e.g. "values/colors.xml" or "values-night/colors.xml"
  // output.content  - resource file content
}
```

`convertDocument()` and `convertList()` return a single string and therefore
only accept input producing exactly one resource file.

```ts
import { AndroidTokenConverter } from "@design-token-kit/core";

const xml = new AndroidTokenConverter({ remBase: 10 }).convertDocument(doc);
```

The `remBase` option sets the pixel base used to resolve `rem` dimensions,
which Android does not support. It follows the same resolution order as the
SwiftUI export: the option, then
`$extensions["design-token-kit"].remBase` on the document root, then `16`.

The `layout` option decides how resources are split across files. The default
`layer` layout creates one file per root token group, mirroring the token
hierarchy, so that a group keeps its colors and dimensions together. The
`type` layout creates one file per Android resource type instead, following
the conventional `colors.xml` / `dimens.xml` naming.

```ts
import { AndroidTokenConverter } from "@design-token-kit/core";

const outputs = new AndroidTokenConverter({ layout: "type" })
  .convertResourceList(list);
```

Colors use the Android `#AARRGGBB` form, sizes use `dp`, and font sizes use
`sp`. Token references are preserved as native `@color/...` and `@dimen/...`
resource references.

Inside a file, resources are grouped into commented sections, one per
second-level token group, carrying the group description when the tokens
declare one.

### Limitations

Android resources are scalar, so composite tokens are decomposed into one
resource per field, named after the composite with a field suffix. Fields
without an Android counterpart are omitted: `cubicBezier` timing functions,
stroke style geometry, and the `inset` flag of shadows. A `fontFamily` token
keeps its first family, since an Android resource names a single family
rather than a fallback list.

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

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
[designmd]: https://github.com/google-labs-code/design.md
