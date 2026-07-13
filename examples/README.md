# Core integration examples

Minimal runnable example that integrates `@design-token-kit/core`
through direct Node scripts. No UI, no dev server, no CLI wrapper.

The goal is simple: copy one of these scripts into a project and adapt the
input and output paths.

The example uses the published npm package, so it matches how an external
application integrates Design Token Kit.

## 1. Validation

Validation script:

```ts
import { DtcgChecker } from "@design-token-kit/core";

const issues = await new DtcgChecker().validate([
    "./src/styles/tokens/tokens.dtcg.json",
    "./src/styles/tokens/tokens.dark.dtcg.json",
]);

for (const issue of issues) {
    console.log(
        issue.severity,
        issue.sourcePath,
        issue.tokenPath?.toString(),
        issue.message,
    );
}

if (issues.some((issue) => issue.severity === "error")) {
    process.exit(2);
}
```

Runnable file: `scripts/check-tokens.mts`

## 2. CSS conversion

CSS build script:

```ts
import { writeFile } from "node:fs/promises";
import { DtcgTokenCssConverter } from "@design-token-kit/core";

const css = await new DtcgTokenCssConverter().convert([
    "./src/styles/tokens/tokens.dtcg.json",
    "./src/styles/tokens/tokens.dark.dtcg.json",
]);

await writeFile("./src/styles/tokens/tokens.css", css, "utf8");
```

Runnable file: `scripts/convert-tokens.mts`

## 3. HTML showcase

Showcase script:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { createTokenHtmlShowcase } from "@design-token-kit/core";

const html = await createTokenHtmlShowcase().showcase([
    "./src/styles/tokens/tokens.dtcg.json",
    "./src/styles/tokens/tokens.dark.dtcg.json",
]);

await mkdir("./dist", { recursive: true });
await writeFile("./dist/showcase.html", html, "utf8");
```

Runnable file: `scripts/generate-showcase.mts`

## `package.json` integration

```json
{
  "scripts": {
    "tokens:check": "node --import tsx ./scripts/check-tokens.mts",
    "tokens:convert": "node --import tsx ./scripts/convert-tokens.mts",
    "tokens:convert:validated": "npm run tokens:check && npm run tokens:convert",
    "tokens:showcase": "node --import tsx ./scripts/generate-showcase.mts"
  }
}
```

This keeps the flow explicit:

- `tokens:check` — standalone validation
- `tokens:convert` — standalone CSS conversion
- `tokens:convert:validated` — explicit workflow: validation first, then conversion
- `tokens:showcase` — runs the showcase pipeline directly; the Core showcase
  builder already includes what it needs internally
- For token inputs, `tokens:showcase` already performs the required
  validation and CSS conversion steps inside the showcase pipeline

## Run

```bash
cd examples
npm install --package-lock=false
npm run tokens:check
npm run tokens:convert
npm run tokens:convert:validated
npm run tokens:showcase
```

Run scripts directly:

```bash
node --import tsx ./scripts/check-tokens.mts
node --import tsx ./scripts/convert-tokens.mts
node --import tsx ./scripts/generate-showcase.mts
```

## Structure

- `src/styles/tokens/tokens.dtcg.json` — base token set
- `src/styles/tokens/tokens.dark.dtcg.json` — dark theme overrides
- `src/styles/tokens/tokens.css` — generated CSS variables
- `dist/showcase.html` — generated HTML showcase
- `scripts/check-tokens.mts` — runnable validation example
- `scripts/convert-tokens.mts` — runnable conversion example
- `scripts/generate-showcase.mts` — runnable showcase generation example
