# Design Token Kit

- [Overview](#overview)
- [Build](#build)
- [Publish](#publish)
- [Packages](#packages)
- [Package Documentation](#package-documentation)

## Overview

The project provides tools for working with design tokens.

Design tokens use a format where design rules are stored in a machine-readable way.
These rules can later be converted to CSS and other UI formats.

Supported input formats:

- DTCG JSON
- HRDT YAML

HRDT stands for Human-Readable Design Tokens. It is a compact YAML-based token
format designed to be easier for humans to read and write than raw DTCG JSON.

HRDT YAML files are automatically converted to DTCG JSON and then passed to the
standard command pipeline: validation, CSS conversion, and showcase generation.

Node.js 18 or newer is required.

## Build

Install dependencies:

```bash
npm install
```

Build workspace packages:

```bash
npm run build
```

`npm run build` creates module build outputs:

- `core/lib`
- `cli/bin`

Prepare distribution directories:

```bash
npm run dist
```

`npm run dist` runs `build` and then creates publish-ready package directories:

- `core/build/dist`
- `cli/build/dist`

## Publish

Release order:

```bash
npm run release:prepare -- 0.1.2
git push
git push --tags
npm run release:publish
```
Manual build commands are only needed outside a release flow:

```bash
npm run build
npm run dist
```

## Packages

- [`@design-token-kit/core`](core/README.md) - core library for validation, parsing, CSS conversion, and HTML showcase generation
- [`@design-token-kit/cli`](cli/README.md) - command line interface `dtokens` for validation, conversion, and showcase generation

## Package Documentation

- Core library usage and main exports: [`core/README.md`](core/README.md)
- CLI installation, commands, and options: [`cli/README.md`](cli/README.md)
