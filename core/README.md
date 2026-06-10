# @design-token-kit/core

Core library for Design Token Kit.

It provides:

- design token validation
- DTCG JSON and HRDT YAML parsing
- conversion of token documents to CSS
- HTML showcase generation

Node.js 18 or newer is required.

## Install

```bash
npm install @design-token-kit/core
```

## What It Does

- validates DTCG token documents against schema and semantic rules
- reads DTCG JSON into the internal `Dtcg` model
- reads HRDT YAML into the same internal `Dtcg` model
- writes DTCG JSON and HRDT YAML
- converts token documents to CSS custom properties
- builds an HTML showcase page from token files or CSS

## Main Exports

Use these entry points for common tasks:

- `DtcgTokenValidator` for validating token files
- `DtcgJsonReader` and `HrdtTokenReader` for reading token documents
- `DtcgJsonWriter` and `HrdtTokenWriter` for writing token documents
- `DtcgTokenCssConverter` or `createTokenCssConverter()` for CSS conversion
- `TokenHtmlShowcaseBuilder` or `createTokenHtmlShowcase()` for HTML showcase generation
- `DtcgSchemaValidator` for schema-only validation

## Basic Usage

```ts
import {
  DtcgTokenValidator,
  DtcgJsonReader,
  DtcgTokenCssConverter,
} from "@design-token-kit/core";

const validator = new DtcgTokenValidator();
const issues = await validator.validate(["./tokens.json"]);

const reader = new DtcgJsonReader();
const doc = reader.parse(`{}`);

const css = new DtcgTokenCssConverter().convertDocument(doc);
console.log(css);
```
