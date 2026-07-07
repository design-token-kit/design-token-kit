# Design Token Kit: Give Your LLM a Design Language, Not a Screenshot

[![AI-Ready](https://img.shields.io/badge/AI-Ready-111827?style=flat-square)](#why-tokens-first)
[![DTCG Native](https://img.shields.io/badge/DTCG-Native-2563eb?style=flat-square)](https://www.designtokens.org/)
[![DESIGN.md Compatible](https://img.shields.io/badge/DESIGN.md-Compatible-059669?style=flat-square)](https://github.com/google-labs-code/design.md)

Stop teaching AI to guess pixels. Teach it to think in design tokens. Validate, 
convert, and showcase design tokens for consistent, AI-native design systems.

- [Overview](#overview)
- [Why Tokens First](#why-tokens-first)
- [Features](#features)
- [Build](#build)
- [Publish](#publish)
- [Packages](#packages)
- [Package Documentation](#package-documentation)
- [Supported Formats](#supported-formats)

## Overview

The project provides tools for working with design tokens.

Design tokens use a format where design rules are stored in a machine-readable way.
These rules can later be converted to CSS and other UI formats.

The project implements the design token format defined by the
Design Tokens Community Group (DTCG).
See the specification at https://www.designtokens.org.

Supported input formats:

* DTCG JSON
* HRDT YAML
* DESIGN.md

DTCG JSON is the standard format defined by the Design Tokens Community Group.

HRDT stands for Human-Readable Design Tokens. It is a compact YAML-based token
format designed to be easier for humans to read and write than raw DTCG JSON.

DESIGN.md is a markdown-based format with YAML frontmatter, designed for
human-centric design system documentation. Supported for reading and conversion
to DTCG JSON. DTCG token trees can be converted to DESIGN.md via
`--outform design-md`.

HRDT YAML files are automatically converted to DTCG JSON and then passed to the
standard command pipeline: checking, CSS conversion, showcase generation, and
statistics reporting.

Node.js 18 or newer is required.

## Why Tokens First

We ran a small blind experiment with several independent agents on the same UI
task: build a product card. One group generated HTML/CSS directly. The other
had one extra requirement: define the design in DTCG tokens first, using three
layers: `primitive`, `semantic`, and `component`.

In the direct HTML/CSS version, the model usually created CSS variables on its
own, but the structure was unstable across runs. Variable names changed, some
values were still hardcoded inside components, and names like `--color-accent`
mixed two different ideas at once: the raw palette value and its UI role.

```css
:root {
  --color-surface: #ffffff;
  --color-accent: #4f46e5;
  --radius-lg: 18px;
  --shadow-card: 0 10px 30px rgba(17, 24, 39, 0.08);
}
```

In the tokens-first version, the model described the design through a stable
three-layer structure and the component CSS referenced tokens instead of raw
values.

```css
.card {
  background: var(--component-card-default-background);
  border-radius: var(--component-card-default-radius);
  box-shadow: var(--component-card-default-shadow);
}
```

That difference mattered across independent runs. In direct mode, each agent
invented its own vocabulary: different variable names, different scales,
different structure. In tokens-first mode, the palettes could differ, but the
design language stayed almost the same: the same primitive values, the same
semantic roles, and the same component references.

This is the key advantage of the tokens-first approach: it gives multiple
independent agents a shared design vocabulary instead of letting each run
invent its own. Design Token Kit is built for that workflow: validate token
files, convert formats, and work with DTCG safely when the model gets the
structure right but misses format details.

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
  * Root layer naming rules (root-layer)
  * Cross-layer reference rules (layer-reference)
  * Raw value placement rules (raw-value-usage)
  * Empty group detection (empty-group)
  * Missing token description detection (missing-description)
* Convert between DTCG JSON, HRDT YAML, and DESIGN.md
* Generate CSS from token files, including Tailwind CSS v4 `@theme` output
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
npm run release:prepare -- X.Y.Z
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

## Supported Formats

- [DTCG](https://www.designtokens.org/) — Design Tokens Community Group JSON
- [HRDT](https://medium.com/@bychinskidm/how-we-made-design-token-kit-an-npm-tool-for-design-tokens-fccf36bd2c65#6821) — Human-Readable Design Tokens YAML
- [DESIGN.md](https://github.com/google-labs-code/design.md) — Markdown-based format with YAML frontmatter

