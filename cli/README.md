# @design-token-kit/cli

The CLI package of Design Token Kit provides the `dtokens` command for
checking, converting, and previewing design tokens from the terminal.

GitHub repository:
https://github.com/design-token-kit/design-token-kit

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
* **Static showcase** - HTML showcase generation from token sources or existing
  CSS
* **Token stats** - text and HTML reports with token counts and breakdowns
* **Source abstraction** - local files, stdin, URLs, and raw token content
  strings

Node.js 18 or newer is required.

## Install

Run without installing:

```bash
npx @design-token-kit/cli check tokens.json
```

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

```bash
dtokens check tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css --out ./tokens.css
dtokens convert tokens.json --outform scss --out ./tokens.scss
dtokens convert tokens.json --outform tailwind-v4 --out ./tokens.tailwind.css
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
  HRDT YAML, DESIGN.md, CSS, SCSS, or Tailwind CSS v4 theme CSS.
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
  `css`, `scss`, `tailwind-v4`. Defaults to `css`.
* `--separator [value]` - scss only: character used to replace `.` in token
  paths when generating flattened variable names. Defaults to `-`.
* `--base-selector [selector]` - tailwind-v4 only: selector for an optional
  mirror of the base custom properties.
* `--theme-selector [template]` - tailwind-v4 only: selector template for
  theme overrides, with `{theme}` placeholder.
* `-o, --out [file]` - output file, defaults to stdout.
  For multi-theme SCSS:
  - omit `--out` to write a tar archive to stdout
  - use `--out <name>.tar` to write a tar archive to file
  - use `--out <name>.scss` to write separate per-theme SCSS files

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

Multiple input sources are only supported when `--outform css` or
`--outform scss` or `--outform tailwind-v4`.

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

The `dtcg` format follows the specification published by the
Design Tokens Community Group at https://www.designtokens.org.

[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
[designmd]: https://github.com/google-labs-code/design.md
