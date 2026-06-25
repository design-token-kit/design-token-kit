# @design-token-kit/cli

The CLI package of Design Token Kit provides the `dtokens` command for
checking, converting, and previewing design tokens from the terminal.

## Features

* **[DTCG 2025.10 check][dtcg]** - schema, model correctness, and lint
  checks for DTCG JSON token documents
* **Model checks** - unresolved references, circular references, group
  references, type mismatches, and deprecated token usage
* **Lint checks** - cross-layer reference, raw value placement, empty group,
  and missing token description rules
* **[HRDT YAML support][hrdt]** - a compact, human-readable alternative
  to DTCG JSON
* **Token format conversion** - read and write DTCG JSON and HRDT YAML
* **CSS generation** - base and theme token sets rendered as CSS custom
  properties
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
dtokens showcase tokens.json --out ./showcase.html --open
dtokens stats tokens.json --out ./stats.html
```

## Input Formats

### DTCG JSON

Use DTCG JSON token documents as the canonical source format for
validation, conversion, CSS generation, and showcase generation.

### HRDT YAML

Use HRDT YAML as a compact, human-readable alternative to DTCG JSON.

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

### HTML showcase

Generate a static HTML preview from DTCG JSON, HRDT YAML, or existing
CSS custom properties.

### Token statistics

Generate a text report to stdout or an HTML stats page from token
sources.

### Serialized token documents

Convert token documents between DTCG JSON and HRDT YAML.

## Commands

* `check [options] [files...]` - check DTCG JSON or HRDT YAML token
  files: schema, model correctness, lint.
* `validate [files...]` - deprecated, use `check --scope validate`.
* `convert [options] [files...]` - convert a token file to DTCG JSON,
  HRDT YAML, or CSS.
* `showcase [options] [files...]` - create HTML showcase from DTCG JSON,
  HRDT YAML, or CSS.
* `stats [options] [files...]` - generate token statistics from DTCG JSON
  or HRDT YAML sources.

## Options

### check

* `--scope <scope>` - how deep to check: `schema`, `validate`, `lint`.
  Each includes the previous.
  Defaults to `validate`.
* `--layers <names>` - comma-separated layer order, lowest first.
  Defaults to `primitive,semantic,component`.
* `--checks <ids>` - comma-separated allow-list of active check ids.
  Defaults to all.

### convert

* `-i, --inform [format]` - input format: `dtcg`, `hrdt`.
* `-f, --outform [format]` - output format: `dtcg`, `hrdt`, `css`.
* `-o, --out [file]` - output file, defaults to stdout.

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
```

## Document Conversion

Convert token documents between DTCG JSON and HRDT YAML.

```bash
dtokens convert tokens.json --outform hrdt
dtokens convert tokens.yaml --inform hrdt --outform dtcg
```

Use `--out` to write the result to a file instead of stdout.

```bash
dtokens convert tokens.json --outform hrdt --out tokens.yaml
```

Multiple input sources are only supported when `--outform css`.

## CSS Conversion

Convert a base token set and optional theme overrides to CSS custom
properties.

```bash
dtokens convert tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css
dtokens convert tokens.json tokens.dark.json --out ./tokens.css
```

## HTML Showcase

Generate an HTML showcase from token sources or from a single CSS
source.

```bash
dtokens showcase tokens.yaml --out ./showcase.html
dtokens showcase tokens.css --out ./showcase.html
dtokens showcase - < tokens.yaml
```

## Token Statistics

Generate token statistics from token sources.

```bash
dtokens stats tokens.yaml
dtokens stats - < tokens.yaml
dtokens stats tokens.yaml --out ./stats.html --open
```

## Supported Formats

* `dtcg` - Design Tokens Community Group JSON format
* `hrdt` - Human-Readable Design Tokens YAML format
* `css` - CSS custom properties output

The `dtcg` format follows the specification published by the
Design Tokens Community Group at https://www.designtokens.org.

[dtcg]: https://www.designtokens.org/
[hrdt]: https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
