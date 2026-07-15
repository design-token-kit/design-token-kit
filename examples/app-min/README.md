# Core integration examples

Minimal runnable example of `@design-token-kit/core` through Node scripts.
It shows validation, CSS generation, and HTML showcase generation without a
CLI wrapper or UI.

## Scripts

- `tokens:check` — validates the example DTCG token files.
- `tokens:convert` — converts the example token files into `tokens.css`.
- `tokens:convert:validated` — runs validation first, then CSS conversion.
- `tokens:showcase` — generates `dist/showcase.html` from the token files.

## Inputs and outputs

- `src/styles/tokens/tokens.dtcg.json` — base token set
- `src/styles/tokens/tokens.dark.dtcg.json` — dark theme overrides
- `src/styles/tokens/tokens.css` — generated CSS variables
- `dist/showcase.html` — generated HTML showcase

## Run

```bash
cd examples
npm install --package-lock=false
npm run tokens:check
npm run tokens:convert
npm run tokens:convert:validated
npm run tokens:showcase
```
