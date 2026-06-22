# @design-token-kit/cli

Command line interface for Design Token Kit.

It provides commands to:

- check design tokens (schema, model correctness, lint)
- convert between DTCG JSON, HRDT YAML, and CSS
- generate HTML showcase pages

Node.js 18 or newer is required.

## Install

Run without installation:

```bash
npx @design-token-kit/cli check tokens.json
```

Install globally:

```bash
npm install -g @design-token-kit/cli
dtokens check tokens.json
```

Install as a local dependency:

```bash
npm install @design-token-kit/cli
```

Show CLI version:

```bash
dtokens -v
dtokens --version
```

## Commands

### `check`

Check one or more DTCG JSON or HRDT YAML token files.

```bash
dtokens check tokens.json
dtokens check tokens.yaml tokens.dark.yaml
dtokens check - tokens.dark.yaml < tokens.yaml
```

The check runs as a fail-fast pipeline of stages.
A file must pass schema before its model is checked, and pass the model
before it is linted.
The `--scope` option selects how deep the pipeline runs.

Options:

- `--scope <scope>`: how deep to check, `schema`, `validate`, or `lint`.
  Each scope includes the previous one.
  Defaults to `validate`.
- `--layers <names>`: comma-separated layer order, lowest first.
  Defaults to `primitive,semantic,component`.
- `--checks <ids>`: comma-separated allow-list of active check ids.
  When omitted, all checks for the selected scope run.

Scopes:

- `schema`: load and validate against the DTCG schema only.
- `validate`: schema plus model-correctness checks.
- `lint`: model-correctness plus lint checks.

Run `dtokens check --help` to list the available check ids with their
scope, severity, and description.

Exit status:

- `0`: success
- `1`: unexpected error
- `2`: issues found

```bash
dtokens check tokens.json --scope schema
dtokens check tokens.json --scope lint
dtokens check tokens.json --scope lint --checks layer-reference
```

### `validate`

Deprecated.
Use `check --scope validate` instead.

```bash
dtokens validate tokens.json
```

### `convert`

Convert a token file to DTCG JSON, HRDT YAML, or CSS.

Defaults:

- `--inform` defaults to `dtcg`
- `--outform` defaults to `css`

```bash
dtokens convert tokens.json
dtokens convert tokens.yaml --inform hrdt --outform css --out ./dist/tokens.css
dtokens convert tokens.json --outform hrdt
```

Options:

- `--inform <format>`: input format override, `dtcg` or `hrdt`
- `--outform <format>`: output format, `dtcg`, `hrdt`, or `css`
- `--out <file>`: write output to a file instead of stdout

### `showcase`

Generate an HTML showcase from token files or CSS.

```bash
dtokens showcase tokens.yaml --out ./dist/showcase.html
```

## Supported Formats

- `dtcg` - Design Tokens Community Group JSON format
- `hrdt` - Human-Readable Design Tokens YAML format
- `css` - CSS custom properties output

The `dtcg` format follows the specification published by the
Design Tokens Community Group at https://www.designtokens.org.
