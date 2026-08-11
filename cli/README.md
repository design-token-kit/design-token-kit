# @design-token-kit/cli

The CLI package of Design Token Kit provides the `dtokens` command for
checking, converting, and previewing design tokens from the terminal.

GitHub repository:
https://github.com/design-token-kit/design-token-kit

Website:
https://design-token-kit.github.io/

## Features

* **[DTCG 2025.10 check][dtcg]** - schema, model correctness, and lint
  checks for DTCG JSON token documents
* **Model checks** - unresolved references, circular references, group
  references, type mismatches, and deprecated token usage
* **Lint checks** - cross-layer reference, raw value placement, empty group,
  and missing token description rules
* **[HRDT YAML support][hrdt]** - a compact, human-readable alternative
  to DTCG JSON
* **[DESIGN.md support][designmd]** -
  read and write design tokens in a markdown-based format with YAML
  frontmatter
* **Token format conversion** - read and write DTCG JSON, HRDT YAML, and
  DESIGN.md
* **CSS generation** - base and theme token sets rendered as CSS custom
  properties, SCSS variables, or Tailwind CSS v4 `@theme` variables
* **SwiftUI generation** - token sets rendered as Swift source using a
  namespaced enum API or a `Theme` struct layer
* **Android generation** - token sets rendered as `res/values` resource XML
  split by token group or resource type, with theme resource directories
* **Static showcase** - HTML showcase generation from token sources or existing
  CSS
* **Token stats** - text and HTML reports with token counts and breakdowns
* **Source abstraction** - local files, stdin, URLs, and raw token content
  strings

Node.js 20.19.0 or newer is required.

## Install

Install globally:

```bash
npm install -g @design-token-kit/cli
dtokens check tokens.json
```

Install locally:

```bash
npm install @design-token-kit/cli
```

## Quick Start

Run with npx:

```bash
npx @design-token-kit/cli check tokens.json
```

```bash
dtokens check tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css --out ./tokens.css
dtokens convert tokens.json --outform scss --out ./tokens.scss
dtokens convert tokens.json --outform tailwind-v4 --out ./tokens.tailwind.css
dtokens convert tokens.json --outform swiftui --out ./DesignTokens.swift
dtokens convert tokens.json --outform android --out ./app/src/main/res
dtokens convert tokens.json --outform design-md
dtokens convert DESIGN.md --inform design-md --outform dtcg
dtokens showcase tokens.json --out ./showcase.html --open
dtokens stats tokens.json --out ./stats.html
```

## Input Formats

### DTCG JSON

Use DTCG JSON token documents as the canonical source format for
validation, conversion, CSS generation, and showcase generation.

### HRDT YAML

Use HRDT YAML as a compact, human-readable alternative to DTCG JSON.

### DESIGN.md

Use DESIGN.md to read and write design tokens in a markdown-based
format with YAML frontmatter. Ideal for human-centric documentation
alongside machine-readable token definitions.

### Base and theme sources

When multiple token sources are provided, the first source is treated
as the base token set and the remaining sources are treated as theme
overrides.

### Stdin

Pass `-` or omit source arguments to read from standard input.

## Output Formats

### CSS custom properties

Generate CSS variables from token sources.
Base tokens are emitted under `:root`.
Theme overrides are emitted under `:root[data-theme="<theme>"]`.

### SCSS variables

Generate SCSS variables from token sources.
Token hierarchy is flattened into variable names by replacing `.` in token
paths with `-` by default, for example:

- `primitive.color.brand` -> `$primitive-color-brand`
- `semantic.color.bg.surface` -> `$semantic-color-bg-surface`

Aliases are emitted as SCSS variable references.

Single-source SCSS output is emitted as one stylesheet.
Multi-theme SCSS output is emitted either as a tar archive or as separate
files per theme, depending on `--out`.

### Tailwind CSS v4 theme output

Generate Tailwind CSS v4 theme variables with an `@theme` block for the
base token set and CSS selectors for theme overrides.

By default the generated stylesheet contains:

- `@import 'tailwindcss';`
- one `@theme { ... }` block for the base token set
- theme override selectors such as `[data-theme="<theme>"] { ... }`

Use `--base-selector` only when you also need an explicit mirror of the base
custom properties outside `@theme`, for example in Shadow DOM scenarios.

### SwiftUI source

Generate Swift source from token sources.
By default tokens are emitted as nested enums with `static let` members.

Use `--swift-type struct` to also emit a `Theme` struct layer and theme
instances for advanced theme switching.

### Android resource XML

Generate Android resource files from token sources. Resources are split by
root token group into `values/primitive.xml`, `values/semantic.xml` and so
on, or by Android resource type with `--android-layout type`.

Themes are written to qualified resource directories holding the overrides
only, with the `dark` theme mapped to `values-night`.

### HTML showcase

Generate a static HTML preview from DTCG JSON, HRDT YAML, DESIGN.md, or
existing CSS. Existing CSS input may be either classic `:root` output or
Tailwind CSS v4 output with `@theme` and theme override selectors.

### Token statistics

Generate a text report to stdout or an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON, HRDT YAML, and DESIGN.md.

## Commands

* `check [options] [files...]` - check DTCG JSON, HRDT YAML, or DESIGN.md
  token files: schema, model correctness, lint.
* `validate [files...]` - alias for `check`.
* `convert [options] [files...]` - convert a token file to DTCG JSON,
  HRDT YAML, DESIGN.md, CSS, SCSS, Tailwind CSS v4 theme CSS, SwiftUI,
  a Figma script, or Android resource XML.
* `showcase [options] [files...]` - create HTML showcase from DTCG JSON,
  HRDT YAML, DESIGN.md, or CSS.
* `stats [options] [files...]` - generate token statistics from DTCG JSON,
  HRDT YAML, or DESIGN.md sources.

## Options

### check

* `--scope <scope>` - how deep to check: `schema`, `validate`, `lint`.
  Each includes the previous.
  Defaults to `validate`.
* `--layers <names>` - comma-separated layer order, lowest first.
  Defaults to `primitive,semantic,component`.
* `--checks <ids>` - comma-separated allow-list of active check ids.
  Defaults to all.
* `--schema <path>` - DTCG JSON Schema: directory path or built-in resource
  (`2025.10`, `2025.10-design.md`). Defaults to `2025.10`.
* `-i, --inform [format]` - input format: `dtcg`, `hrdt`, `design-md`
  (default: auto-detect).

### convert

* `-i, --inform [format]` - input format: `dtcg`, `hrdt`, `design-md`
  (default: auto-detect).
* `-f, --outform [format]` - output format: `dtcg`, `hrdt`, `design-md`,
  `css`, `scss`, `tailwind-v4`, `swiftui`, `figma-script`, `android`.
  Defaults to `css`.
* `--separator [value]` - scss only: character used to replace `.` in token
  paths when generating flattened variable names. Defaults to `-`.
* `--base-selector [selector]` - tailwind-v4 only: selector for an optional
  mirror of the base custom properties.
* `--theme-selector [template]` - tailwind-v4 only: selector template for
  theme overrides, with `{theme}` placeholder.
* `--swift-type [type]` - SwiftUI only: output form `enum` or `struct`.
  Defaults to `enum`.
* `--android-layout [layout]` - android only: how resources are split across
  files. `layer` creates one file per root token group, `type` one file per
  Android resource type. Defaults to `layer`.
* `--rem-base [pixels]` - android and swiftui only: pixel base used to resolve
  `rem` dimensions, which these platforms do not support. Overrides
  `$extensions["design-token-kit"].remBase` declared by the token document.
  Defaults to `16`.
* `-o, --out [file]` - output file, defaults to stdout.
  For multi-theme SCSS:
  - omit `--out` to write a tar archive to stdout
  - use `--out <name>.tar` to write a tar archive to file
  - use `--out <name>.scss` to write separate per-theme SCSS files

  For Android:
  - omit `--out` to write a tar archive of the resource tree to stdout
  - use `--out <name>.tar` to write that archive to file
  - use `--out <directory>` to write the resource tree into a directory

### showcase

* `-o, --out <file>` - output HTML file name or path.
* `--open` - open the generated HTML in browser, only with `--out`.

### stats

* `-o, --out <file>` - output HTML file name or path.
* `--open` - open the generated HTML in browser, only with `--out`.

## Checking

Check one or more DTCG JSON or HRDT YAML token sources.

```bash
dtokens check tokens.json
dtokens check tokens.yaml tokens.dark.yaml
dtokens check - tokens.dark.yaml < tokens.yaml
dtokens check DESIGN.md --inform design-md
dtokens check tokens.json --schema 2025.10-design.md
```

The check runs as a fail-fast pipeline of stages.
A file must pass schema before its model is checked, and pass the model
before it is linted.
The `--scope` option selects how deep the pipeline runs.

Scopes:

* `schema`: load and validate against the DTCG schema only.
* `validate`: schema plus model-correctness checks.
* `lint`: model-correctness plus lint checks.

Run `dtokens check --help` to list the available check ids with their
scope, severity, and description.

Exit status:

* `0`: success
* `1`: unexpected error
* `2`: issues found

```bash
dtokens check tokens.json --scope schema
dtokens check tokens.json --scope lint
dtokens check tokens.json --scope lint --checks layer-reference
dtokens check DESIGN.md --inform design-md --scope validate
```

## Document Conversion

Convert token documents between DTCG JSON, HRDT YAML, and DESIGN.md.

```bash
dtokens convert tokens.json --outform hrdt
dtokens convert tokens.yaml --inform hrdt --outform dtcg
dtokens convert tokens.json --outform design-md
dtokens convert DESIGN.md --inform design-md --outform dtcg
```

Use `--out` to write the result to a file instead of stdout.

```bash
dtokens convert tokens.json --outform hrdt --out tokens.yaml
```

Multiple input sources are supported by the formats that express theme
overrides: `css`, `scss`, `tailwind-v4`, `swiftui`, `figma-script` and
`android`.

## CSS Conversion

Convert a base token set and optional theme overrides to CSS custom
properties.

```bash
dtokens convert tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css
dtokens convert tokens.json tokens.dark.json --out ./tokens.css
```

## SCSS Conversion

Convert a token set to SCSS variables.

```bash
dtokens convert tokens.json --outform scss
dtokens convert tokens.json --outform scss --separator _
```

With the default separator:

- `primitive.color.brand` -> `$primitive-color-brand`

With `--separator _`:

- `primitive.color.brand` -> `$primitive_color_brand`

For multiple token sources, SCSS output supports both archive and separate-file
contracts.

```bash
dtokens convert tokens.json tokens.dark.json --outform scss
dtokens convert tokens.json tokens.dark.json --outform scss --out ./tokens.tar
dtokens convert tokens.json tokens.dark.json --outform scss --out ./tokens.scss
```

Without `--out`, the command writes a tar archive to stdout.

With `--out ./tokens.tar`, the command writes a tar archive containing:

```text
tokens.base.scss
tokens.dark.scss
```

With `--out ./tokens.scss`, the command writes separate files:

```text
./tokens.base.scss
./tokens.dark.scss
```

Theme file names are derived from source file names after stripping technical
suffixes such as `.dtcg`, `.hrdt`, `.valid`, and `.invalid`. For example:

- `showcase.dark.valid.dtcg.json` -> `dark`
- `tokens.dark.json` -> `dark`

## Tailwind CSS v4 Conversion

Convert a base token set and optional theme overrides to Tailwind CSS v4
`@theme` output.

```bash
dtokens convert tokens.json --outform tailwind-v4
dtokens convert tokens.json tokens.dark.json --outform tailwind-v4 --out ./tokens.tailwind.css
dtokens convert tokens.json tokens.dark.json --outform tailwind-v4 --base-selector :host --theme-selector ":host([data-theme='{theme}'])"
```

## SwiftUI Conversion

Convert a base token set and optional theme overrides to Swift source.

```bash
dtokens convert tokens.json --outform swiftui
dtokens convert tokens.json tokens.dark.json --outform swiftui --out ./DesignTokens.swift
dtokens convert tokens.json tokens.dark.json --outform swiftui --swift-type struct
```

The default `enum` form emits one base enum and one enum per theme.
The `struct` form also emits a `Theme` struct and theme instances.

SwiftUI has no `rem` unit, so `rem` dimensions are resolved against a pixel
base while `px` is emitted as is, `pt` being its iOS equivalent. The base is
taken from `--rem-base`, then from
`$extensions["design-token-kit"].remBase` in the token document, then
defaults to `16`.

```bash
dtokens convert tokens.json --outform swiftui --rem-base 10
```

## Figma Script Conversion

Convert a token set to a script that builds it inside Figma.

```bash
dtokens convert tokens.json --outform figma-script
dtokens convert tokens.json tokens.dark.json --outform figma-script --out ./tokens.figma.js
```

The Figma Plugin API runs only inside the editor, so tokens cannot be written
from outside. Paste the generated script into a plugin that evaluates code,
such as [Scripter](https://www.figma.com/community/plugin/757836922707087381),
and run it.

The script creates one variable collection per token layer, one mode per theme,
and the variables and styles the tokens describe. References become Figma
variable aliases rather than copied values, so the layering survives. Running
the script again updates what it created instead of duplicating it.

Figma represents five of the thirteen DTCG types: `color`, `dimension`,
`number`, `typography` and `shadow`. The rest are listed in the script header
and reported when it runs.

## Android Conversion

Convert a base token set and optional theme overrides to Android resource
XML.

```bash
dtokens convert tokens.json --outform android > res.tar
dtokens convert tokens.json --outform android --out ./app/src/main/res
dtokens convert tokens.json tokens.dark.json --outform android --out ./app/src/main/res
dtokens convert tokens.json --outform android --android-layout type --out ./res
dtokens convert tokens.json --outform android --rem-base 10 --out ./res
```

Resources are named in `snake_case` from the token path. By default they are
split by root token group, so the files mirror the token hierarchy and keep
tokens that belong together in one place:

```
res/
  values/
    primitive.xml
    semantic.xml
    component.xml
  values-night/
    semantic.xml
```

Use `--android-layout type` to split by Android resource type instead,
following the conventional resource file naming:

```
res/
  values/
    colors.xml
    dimens.xml
    integers.xml
    floats.xml
    strings.xml
  values-night/
    colors.xml
```

Inside a file, resources are grouped into commented sections, one per
second-level token group, carrying the group description when the tokens
declare one:

```xml
<resources>

    <!-- semantic.color
         Semantic colors mapped to the primitive palette
    -->
    <color name="semantic_color_primary">@color/primitive_color_red</color>

    <!-- semantic.space -->
    <dimen name="semantic_space_md">16dp</dimen>

</resources>
```

Colors use the Android `#AARRGGBB` form, sizes use `dp`, and font sizes use
`sp`. Token references become native resource references:

```xml
<color name="primitive_color_red">#ffff0000</color>
<color name="semantic_color_primary">@color/primitive_color_red</color>
<dimen name="spacing_md">16dp</dimen>
<dimen name="font_size_md">16sp</dimen>
```

### Limitations

Android resources are scalar, so composite tokens are decomposed into one
resource per field, named after the composite with a field suffix, for
example `typography_body_font_size`. Fields without an Android counterpart
are omitted: `cubicBezier` timing functions, stroke style geometry, and the
`inset` flag of shadows. A `fontFamily` token keeps its first family, since
an Android resource names a single family rather than a fallback list.

## HTML Showcase

Generate an HTML showcase from token sources or from a single CSS
source.

```bash
dtokens showcase tokens.yaml --out ./showcase.html
dtokens showcase DESIGN.md --out ./showcase.html
dtokens showcase tokens.css --out ./showcase.html
dtokens showcase - < tokens.yaml
```

## Token Statistics

Generate token statistics from token sources.

```bash
dtokens stats tokens.yaml
dtokens stats DESIGN.md
dtokens stats - < tokens.yaml
dtokens stats tokens.yaml --out ./stats.html --open
```

## Supported Formats

* `dtcg` - [DTCG JSON](https://www.designtokens.org/) (schema: `2025.10`, extended: `2025.10-design.md`)
* `hrdt` - [HRDT YAML](https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821)
* `design-md` - [DESIGN.md](https://github.com/google-labs-code/design.md) markdown format
* `css` - CSS custom properties output
* `scss` - SCSS variables output
* `tailwind-v4` - Tailwind CSS v4 `@theme` output
* `swiftui` - SwiftUI source output
* `figma-script` - script creating Figma variables and styles
* `android` - Android resource XML output

The `dtcg` format follows the specification published by the
Design Tokens Community Group at https://www.designtokens.org.

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
[designmd]: https://github.com/google-labs-code/design.md
