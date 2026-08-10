# Playground

Reference design system for the Figma playground project, with the scripts that
build it inside Figma. It serves as an example for users and as a place to work
out recommendations for designers.

- [Contents](#contents)
- [Token structure](#token-structure)
- [What Figma can express](#what-figma-can-express)
- [Building the Figma file](#building-the-figma-file)
- [The showcase](#the-showcase)
- [Verifying the tokens](#verifying-the-tokens)

## Contents

| File | Role |
| --- | --- |
| `tokens.json` | Base theme: 151 tokens covering all 13 DTCG types |
| `tokens.dark.json` | Dark theme: 12 colours and 2 shadows |
| `showcase.figma.js` | Builds the showcase page from the document's variables |

The token file names follow the convention the Figma plugin uses when exporting
(`tokens.json` and `tokens.<mode>.json`), so an export from Figma lines up with
this set file by file.

## Token structure

The set is built on three layers.

`primitive` holds the palette, scales, curves and typefaces. It is the only
layer carrying raw values.

`semantic` maps primitives onto roles: background, text, borders, actions and
statuses. Every token references a primitive.

`component` describes properties of buttons, inputs, cards, badges and modals.
Every token references a semantic token, never a primitive directly. The
`layer-reference` rule requires that a semantic token always sits between a
component and a primitive.

The dark theme overrides the `primitive` layer only. The `semantic` and
`component` layers are absent from it and inherit from the base theme. Switching
themes changes the palette without touching roles or components.

Every token carries a `$description`. On import the descriptions become Figma
variable descriptions and document the system inside the file itself.

## What Figma can express

The set deliberately covers all 13 DTCG types, while Figma represents five:

- `color` as a COLOR variable
- `dimension` as a FLOAT variable
- `number` as a FLOAT variable scoped to OPACITY
- `typography` as a text style
- `shadow` as an effect style

Eight types have no Figma representation and are skipped on import:
`fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `strokeStyle`, `border`,
`transition` and `gradient`.

A further limit applies to styles: Figma variables reference each other, styles
do not. A `semantic` or `component` token pointing at a typography or shadow
token is therefore skipped as well.

The token script lists every skipped token with its reason, both in the file
header and in the report it prints. That contrast between the source set and
what Figma holds is a deliverable of the playground, not a shortcoming of the
set.

## Building the Figma file

The Figma Plugin API runs only inside the editor, so tokens cannot be written
from outside. The REST API is no way around it: it creates neither styles nor
nodes on any plan, and writing variables requires an Enterprise plan.

The file is therefore built by two scripts pasted into
[Scripter](https://www.figma.com/community/plugin/757836922707087381), a
published plugin that evaluates code. No desktop app and no plugin of your own
are needed.

1. Generate the token script:

   ```bash
   npm run dtokens -- convert examples/playground/tokens.json examples/playground/tokens.dark.json -f figma-script -o tokens.figma.js
   ```

2. Create a design file in the Figma project, for example
   `Design Token Kit - Playground`.
3. Open Scripter in that file, paste the contents of `tokens.figma.js` and run
   it. It creates the collections `Primitive`, `Semantic` and `Component`, their
   variables, and the text and effect styles.
4. Paste the contents of `showcase.figma.js` and run it.

Both scripts print a report, which Scripter shows below the code. Rerunning
either one updates what it created before rather than adding a second copy.

### Variable modes

Variable modes need a paid Figma plan. On a free plan the `Dark` mode is not
created, the token script says so, and the dark overrides are skipped. The rest
of the import is unaffected.

## The showcase

`showcase.figma.js` builds the `Tokens Showcase` page from the variables and
styles of the open document. Sections, one column each: primitive colours,
semantic colours, the spacing scale, the corner radius scale, plain numbers,
typography samples, shadow samples, and the reference chains linking component
tokens through semantic ones to primitives.

The first two segments of a name choose the section, the last one labels the
entry:

```
primitive/color/*        -> Primitive colours
primitive/dimension/*    -> Spacing scale, Corner radius
primitive/number/*       -> Numbers
semantic/color/*         -> Semantic colours
component/**             -> Reference chains
```

Component variables carry references, so they appear in the chains. The showcase
covers the three layers above and skips other names.

Colour swatches are bound to their variables rather than filled with a copied
value, so editing a variable updates the swatch.

## Verifying the tokens

```bash
npm run dtokens -- check --scope lint examples/playground/tokens.json examples/playground/tokens.dark.json
```

Expected result: `Check passed.` with no warnings.

Inspecting the same set as CSS:

```bash
npm run dtokens -- convert examples/playground/tokens.json examples/playground/tokens.dark.json -f css
```

Recommendations for designers are in [`docs/designer.adoc`](../../docs/designer.adoc).
