# Core integration example

Minimal runnable example of `@design-token-kit/core` through one Node script.
It keeps token paths in one place and calls the library directly.

## Scripts

- `tokens:check` — validates the configured token files.
- `tokens:convert` — validates tokens, then writes `tokens.css`.
- `tokens:showcase` — writes `showcase.html` from the token files.

## Inputs and outputs

- `src/styles/tokens/tokens.json` — base token set
- `src/styles/tokens/tokens.dark.json` — dark theme overrides
- `src/styles/tokens/tokens.css` — generated CSS variables
- `dist/showcase.html` — generated HTML showcase

## Run

```bash
cd examples/app-min
npm install --package-lock=false
npm run tokens:check
npm run tokens:convert
npm run tokens:showcase
```
