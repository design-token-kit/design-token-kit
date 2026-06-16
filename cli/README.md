# @design-token-kit/cli

The CLI package of Design Token Kit provides the `dtokens` command for
validating, converting, and previewing design tokens from the terminal.

## Features

* **DTCG 2025.10 validation** - schema validation for DTCG JSON token
  documents
* **Semantic checks** - unresolved references, circular references,
  group references, type mismatches, and deprecated token usage
* **HRDT YAML support** - a compact, human-readable alternative to
  DTCG JSON
* **Token format conversion** - read and write DTCG JSON and HRDT YAML
* **CSS generation** - base and theme token sets rendered as CSS
  custom properties
* **Static showcase** - HTML showcase generation from token sources or
  existing CSS
* **Source abstraction** - local files, stdin, URLs, and raw token
  content strings

Node.js 18 or newer is required.

## Install

Run without installing:

```bash
npx @design-token-kit/cli validate tokens.json
```

Install globally:

```bash
npm install -g @design-token-kit/cli
dtokens --version
```

Install locally:

```bash
npm install @design-token-kit/cli
```

## Quick Start

```bash
dtokens validate tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css --out ./tokens.css
dtokens showcase tokens.json --out ./showcase.html --open
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

Generate CSS variables from token sources. Base tokens are emitted
under `:root`; theme overrides are emitted under
`:root[data-theme="<theme>"]`.

### HTML showcase

Generate a static HTML preview from DTCG JSON, HRDT YAML, or existing
CSS custom properties.

### Serialized token documents

Convert token documents between DTCG JSON and HRDT YAML.

## Commands

| Command | Description |
| --- | --- |
| `validate [files...]` | Validate DTCG JSON or HRDT YAML token files. |
| `convert [options] [files...]` | Convert a token file to DTCG JSON, HRDT YAML, or CSS. |
| `showcase [options] [files...]` | Create HTML showcase from DTCG JSON, HRDT YAML, or CSS. |

## Options

### convert

| Option | Description |
| --- | --- |
| `-i, --inform [format]` | Input format: `dtcg`, `hrdt` |
| `-f, --outform [format]` | Output format: `dtcg`, `hrdt`, `css` |
| `-o, --out [file]` | Output file, defaults to stdout |

### showcase

| Option | Description |
| --- | --- |
| `-o, --out <file>` | Output HTML file name or path |
| `--open` | Open the generated HTML in browser, only with `--out` |

## Validation

Validate one or more DTCG JSON or HRDT YAML token sources.

```bash
dtokens validate tokens.json
dtokens validate tokens.yaml
dtokens validate tokens.yaml tokens.dark.yaml
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
