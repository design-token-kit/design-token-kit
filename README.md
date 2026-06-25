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

The project implements the design token format defined by the
Design Tokens Community Group (DTCG).
See the specification at https://www.designtokens.org.

Supported input formats:

* [DTCG JSON][dtcg]
* [HRDT YAML][hrdt]

DTCG JSON is the standard format defined by the Design Tokens Community Group.

HRDT stands for Human-Readable Design Tokens. It is a compact YAML-based token
format designed to be easier for humans to read and write than raw DTCG JSON.

HRDT YAML files are automatically converted to DTCG JSON and then passed to the
standard command pipeline: checking, CSS conversion, showcase generation, and
statistics reporting.

Node.js 18 or newer is required.

## Features

* Check token files through a fail-fast pipeline with selectable depth
  (schema, validate, lint)
* Validate DTCG JSON against the DTCG schema (structural validation)
* Check token model correctness:
  * Unresolved reference detection
  * Circular reference detection
  * Reference-to-group detection
  * Type mismatch detection
  * Gradient duplicate stop detection
  * Deprecated token usage warnings
* Lint tokens:
  * Cross-layer reference rules (layer-reference)
  * Raw value placement rules (raw-value-usage)
  * Empty group detection (empty-group)
* Convert between DTCG JSON and HRDT YAML
* Generate CSS from token files (theme support)
* Generate HTML token showcase page
* Generate token statistics as text or HTML

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

Release flow:

```bash
npm run release:prepare -- 0.1.2
git push
git push --tags
```

`npm run release:prepare` bumps package versions, runs build and tests, stages
the publishable package contents, and creates the release commit and `vX.Y.Z`
tag.

After the tagged commit is pushed, GitHub Actions runs the publish workflow
([`.github/workflows/publish.yml`](.github/workflows/publish.yml)), which runs
the build/dist/publish steps and publishes the packages to npm.

Manual build commands are only needed outside a release flow:

```bash
npm run build
npm run dist
```

## Packages

- [`@design-token-kit/core`](core/README.md) - core library for validation, parsing, CSS conversion, HTML showcase generation, and token statistics
- [`@design-token-kit/cli`](cli/README.md) - command line interface `dtokens` for checking, conversion, showcase generation, and token statistics

## Package Documentation

- Core library usage and main exports: [`core/README.md`](core/README.md)
- CLI installation, commands, and options: [`cli/README.md`](cli/README.md)


[dtcg]: https://www.designtokens.org/
[hrdt]:https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821
