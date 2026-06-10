# @design-token-kit/cli

Command line interface for Design Token Kit.

It provides commands to:

- validate design tokens
- convert between DTCG JSON, HRDT YAML, and CSS
- generate HTML showcase pages
- run round-trip read/write checks

Node.js 18 or newer is required.

## Install

Run without installation:

```bash
npx @design-token-kit/cli validate tokens.json
```

Install globally:

```bash
npm install -g @design-token-kit/cli
dtokens validate tokens.json
```

Install as a local dependency:

```bash
npm install @design-token-kit/cli
```

## Commands

### `validate`

Validate one or more DTCG JSON or HRDT YAML token files.

```bash
dtokens validate tokens.json
dtokens validate tokens.yaml
dtokens validate light.json dark.yaml
```

### `convert`

Convert a token file to DTCG JSON, HRDT YAML, or CSS.

Defaults:

- `--inform` defaults to `dtcg`
- `--outform` defaults to `css`

```bash
dtokens convert tokens.json
dtokens convert tokens.json --out tokens.css
dtokens convert tokens.yaml --inform hrdt --outform css
dtokens convert tokens.yaml --inform hrdt --outform dtcg
dtokens convert tokens.json --outform hrdt
```

Options:

- `--inform <format>`: input format override, `dtcg` or `hrdt`
- `--outform <format>`: output format, `dtcg`, `hrdt`, or `css`
- `--out <file>`: write output to a file instead of stdout

### `showcase`

Generate an HTML showcase from token files or CSS.

```bash
dtokens showcase tokens.json
dtokens showcase tokens.css --out showcase.html
dtokens showcase tokens.json --out showcase.html
```

### `test`

Load a token file, build the internal model, and print it back in the same or 
requested format.

```bash
dtokens test tokens.json
dtokens test tokens.yaml
dtokens test tokens.yaml --outform hrdt
dtokens test tokens.json --outform dtcg
```

## Supported Formats

- `dtcg` - Design Tokens Community Group JSON format
- `hrdt` - Human-Readable Design Tokens YAML format
- `css` - CSS custom properties output
