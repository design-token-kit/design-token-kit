# Playground: reference token set

Reference design system for the Figma playground project. The set serves as an
example for users and as a place to work out recommendations for designers.

- [Contents](#contents)
- [Structure](#structure)
- [Type coverage](#type-coverage)
- [Verification](#verification)
- [Populating the Figma file](#populating-the-figma-file)

## Contents

The set consists of two files:

- `tokens.json` holds the base theme: 151 tokens covering all 13 DTCG types
- `tokens.dark.json` holds the dark theme, overriding 12 colours and 2 shadows

File names follow the export convention of the Figma plugin (`tokens.json` and
`tokens.<mode>.json`), so a re-export compares against the source file by file.

## Structure

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

Every token carries a `$description`. On import into Figma the descriptions
become variable descriptions and document the system inside the file itself.

## Type coverage

The set deliberately covers all 13 DTCG types, while Figma expresses only 5.

Figma represents these types:

- `color` as a COLOR variable
- `dimension` as a FLOAT variable
- `number` as a FLOAT variable scoped to OPACITY
- `typography` as a text style
- `shadow` as an effect style

These types have no Figma representation and are lost on export: `fontFamily`,
`fontWeight`, `duration`, `cubicBezier`, `strokeStyle`, `border`, `transition`
and `gradient`.

The difference between the source set and the result of a re-export shows where
the platform ends. That contrast is a deliverable of the playground, not a
shortcoming of the set.

## Verification

```bash
npm run dtokens -- check --scope lint examples/playground/tokens.json examples/playground/tokens.dark.json
```

Expected result: `Check passed.` with no warnings.

Inspecting the result as CSS:

```bash
npm run dtokens -- convert examples/playground/tokens.json examples/playground/tokens.dark.json -f css
```

## Populating the Figma file

The REST API creates neither styles nor nodes on any plan, and writing variables
requires an Enterprise plan. The file is therefore populated by the plugin from
the editor. These steps are manual.

1. Create a file named `Design Token Kit - Playground` in the Figma project.
2. Build the plugin: `npm run build -w @design-token-kit/figma-plugin`.
3. In the Figma desktop app: Plugins, Development, Import plugin from manifest,
   then select `figma-plugin/manifest.json`.
4. Open the playground file, run the plugin, select both token files, strategy
   `merge`.
5. Check the result: collections `Primitive`, `Semantic` and `Component`, modes
   `Light` and `Dark` on `Primitive`, text styles and effect styles.
6. Run the export and compare the losses against the expected ones.
7. Publish the file as a library.
8. Share it with view access by link and add the link to the documentation.

Recommendations for designers are in [`docs/designer.adoc`](../../docs/designer.adoc).
