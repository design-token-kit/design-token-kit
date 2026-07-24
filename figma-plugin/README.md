# Figma Plugin

This package exports the current Figma file JSON through two separate paths and
normalizes both into one internal DTO.

## Current scope

- exports `figma.plugin.json` through Plugin API
- exports `figma.rest.json` through the real Figma REST API
- normalizes both payloads into one internal DTO
- previews the last exported JSON in the plugin UI

## Export model

The export lives in:

- `figma-file-json.ts` - whole-document Plugin API export and shared DTO adapters
- `code.ts` - UI message handling and REST API fetch

The internal DTO currently contains:

- file name
- page tree
- component ids
- component set ids
- style ids

## Scripts

- `npm run build` - compile TypeScript into `code.js`
- `npm run lint` - run ESLint
- `npm run test` - rebuild and run export/DTO tests with `vitest`
- `npm run watch` - rebuild on file changes

## Tests

Tests run the generated `code.js` inside a Node `vm` context with a minimal
mock of the Figma runtime and verify that REST-like and Plugin-like responses
normalize into the same DTO.
