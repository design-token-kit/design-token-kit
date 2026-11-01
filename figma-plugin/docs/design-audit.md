# Design Audit

The **Design** tab of the plugin audits the layers of the open Figma file. It
answers two questions:

- **Accessibility**: can the text a reader sees on this page be read? It
  reports text with too little contrast, text that is too small, and body text
  whose lines are set too tightly.
- **Token usage**: is the page built from the design system? It reports
  colours, spacing, radii and font sizes that are hard-coded instead of bound
  to a variable or a style, and layers bound to primitive variables where
  semantic ones exist.

The token system itself, its layers, references and types, is checked on the
**Tokens** tab.

The audit is read-only. It never changes the file.

- [Running the audit](#running-the-audit)
- [Which layers are audited](#which-layers-are-audited)
- [How a layer is measured](#how-a-layer-is-measured)
- [The checks](#the-checks)
  - [Text contrast is below WCAG AA](#text-contrast-is-below-wcag-aa)
  - [Text is smaller than 12px](#text-is-smaller-than-12px)
  - [Body text lines are too tight](#body-text-lines-are-too-tight)
  - [Text contrast could not be evaluated](#text-contrast-could-not-be-evaluated)
- [WCAG AA in the plugin](#wcag-aa-in-the-plugin)
- [Token usage](#token-usage)
  - [Which properties are audited](#which-properties-are-audited)
  - [Which tokens are suggested](#which-tokens-are-suggested)
  - [Values are not bound to variables](#hardcoded-value)
  - [Layers use primitive variables directly](#primitive-binding)
  - [Token coverage](#token-coverage)
- [Reading the results](#reading-the-results)
- [The scores](#the-scores)
- [Limitations](#limitations)

## Running the audit

The audit runs when the Design tab is opened for the first time, when the
scope changes, and on **Run again**.

- **Current page** audits the layers of the page open in Figma.
- **Entire file** loads every page first, then audits all of them. Each layer
  path then starts with its page name. On a large file this takes a while.

The rules themselves live in `@design-token-kit/core`. The accessibility rules
are the ones `dtokens audit` applies to token files. The plugin only turns
Figma layers into what the rules read: for text, a text colour, a background
colour, a font size, a font weight and a line height; for token usage, each
property's value and the variable or style it is bound to.

## Which layers are audited

Every text layer of the scope is collected, then a layer is left out when a
reader does not see it as text:

| Left out | Why |
| --- | --- |
| The layer or one of its parents is hidden | Nothing is drawn. |
| The layer has opacity 0 | Nothing is drawn. |
| The text is empty or only spaces | There is nothing to read. |
| The layer has no visible fill | The text is not painted. |
| The layer is a mask | The text shapes another layer; it is not read. |
| The layer is inside a boolean operation | The text is part of a shape, for example a letter cut out of an icon. |
| The text is only icon font glyphs | Icon fonts put their glyphs in the Unicode Private Use Area; those are icons, not text. Text that mixes a glyph with words is audited. |

Main components and their instances are both audited, as each is drawn on the
canvas.

## How a layer is measured

### Text colour

The colour is the layer's fill. A paint's own opacity and the layer's opacity
are multiplied into the alpha of the colour. When the fill has several visible
paints, they are blended into the single colour they render as.

The colour cannot be measured when the text is filled with a gradient, or when
its characters have different colours (Figma reports the fill as mixed). Such a
layer goes to [Not checked](#text-contrast-could-not-be-evaluated).

### Background colour

The background is what lies under the centre of the text. The plugin looks
straight down through the layers at that point:

1. The siblings painted below the text layer, from the nearest one down. Only
   visible siblings whose bounds contain the point count; lines and other text
   layers are ignored. A sibling with children, such as a group or a frame, is
   looked into first, then its own fills are read.
2. The fills of the parent frame, which are painted below its children.
3. Steps 1 and 2 again for each parent above, up to the page.
4. The page background.
5. White, when nothing above was opaque.

Fills are read from the top paint down. Hidden paints and fully transparent
paints are skipped. A translucent paint is kept and the search goes on below
it, until an opaque paint is reached. All the translucent layers found on the
way are then blended over that opaque one, the way Figma renders them.

When the search meets a gradient, an image, a video or a pattern, the
background has no single colour and the layer goes to
[Not checked](#text-contrast-could-not-be-evaluated).

Colour fills bound to variables are read as Figma currently renders them, so
the result follows the variable mode set on the layer or its frame.

### Font size and weight

The font size and weight are the layer's. When the text mixes several sizes or
weights, the smallest size and the lightest weight are taken: the hardest part
to read decides.

Sizes can have decimals, such as `10.32px`, when an instance of a component is
scaled: Figma reports the size after scaling.

### Line height

The line height is read as a multiple of the font size:

- a value in percent is divided by 100, so 120% becomes `1.2`;
- a value in pixels is divided by the font size, so 16px on 16px text becomes
  `1`;
- **Auto** is not audited, because its value depends on the font.

The line height is only read for text that wraps: text with a line break, or a
layer at least one and a half lines tall. The spacing of a single line does not
affect reading.

## The checks

### Text contrast is below WCAG AA

**Error.** The contrast between the text colour and its background is below the
WCAG AA minimum:

| Text | Minimum |
| --- | --- |
| Normal text | 4.5:1 |
| Large text: 24px and above, or 18.66px and above with a weight of 700 or more | 3:1 |

The measured value is the contrast ratio, from `1.00:1`, where text and
background have the same colour, to `21.00:1`, black on white. A value of
`1.00:1` means the text is invisible; when the text is in fact visible, the
background was read from the wrong layer (see [Limitations](#limitations)).

The description names the lowest ratio found. The layers are listed from the
lowest ratio up. How the ratio is computed is described in
[WCAG AA in the plugin](#wcag-aa-in-the-plugin).

Fix: use a darker text colour on light surfaces and a lighter one on dark
surfaces, ideally a semantic text variable that is known to pass on that
surface.

### Text is smaller than 12px

**Warning.** The font size is below 12px. WCAG sets no minimum font size, so
this is a readability guideline rather than a WCAG failure.

The measured value is the font size in pixels. The description names the
smallest size found, and the layers are listed from the smallest up.

Fix: apply a text style from the typography scale that is large enough to read.

### Body text lines are too tight

**Warning.** Body text that wraps onto several lines has a line height below
1.3. Text of 18px and above counts as a heading and is not audited, as headings
are commonly set tighter. This is a readability guideline; see
[WCAG AA in the plugin](#wcag-aa-in-the-plugin) for how it relates to WCAG.

The measured value is the line height as a multiple of the font size. `1`
means the lines are as tall as the letters, so they nearly touch. The
description names the tightest value found.

Fix: increase the line height, or apply a body text style.

### Text contrast could not be evaluated

**Not checked.** The contrast of these layers cannot be calculated, so they
need a check by eye. The value says why:

| Value | Meaning |
| --- | --- |
| `gradient` | The text, or a layer under it, is filled with a gradient. |
| `image` | The text sits on an image, a video or a pattern. |
| `mixed` | The characters of the text have different colours. |
| `translucent` | Nothing opaque was found under a translucent background. |

These layers do not affect the score.

Fix: check them by eye, or put a solid fill behind the text.

## WCAG AA in the plugin

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the accessibility standard the
audit follows. Its level AA is the level most laws and design systems require.
The plugin covers one AA criterion fully and uses two more as guidance.

### 1.4.3 Contrast (Minimum)

[Success criterion 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum)
requires text to have a contrast ratio of at least 4.5:1 with its background,
and large text at least 3:1. This is the
[Text contrast](#text-contrast-is-below-wcag-aa) check.

The plugin computes the ratio as WCAG defines it:

1. Both colours are converted to sRGB. A translucent text colour is first
   blended over its background.
2. Each colour's [relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance)
   is computed: each channel is linearised, then
   `L = 0.2126 R + 0.7152 G + 0.0722 B`, from 0 for black to 1 for white.
3. The [contrast ratio](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) is
   `(L1 + 0.05) / (L2 + 0.05)`, with `L1` the lighter colour.
4. The ratio is compared with the minimum without rounding, as WCAG requires: a
   ratio of 4.499 fails 4.5. For display it is cut to two decimals rather than
   rounded, so a failing ratio is never shown as `4.50:1`.

[Large text](https://www.w3.org/TR/WCAG22/#dfn-large-scale) is at least 18pt,
or 14pt bold. In the pixels Figma uses that is 24px, or 18.66px with a weight of
700 or more.

WCAG exempts text that is part of an inactive control, a logo, or pure
decoration. The plugin cannot tell those apart, so such text is reported too;
it can be ignored when it is one of these.

The rules also know level AAA (7:1 and 4.5:1, from
[criterion 1.4.6](https://www.w3.org/TR/WCAG22/#contrast-enhanced)), where text
that passes AA but not AAA is a warning. The plugin audits against AA.

### 1.4.12 Text Spacing

[Success criterion 1.4.12](https://www.w3.org/TR/WCAG22/#text-spacing) asks
that content still works when a reader raises the line height to 1.5 times the
font size. It is about the code accepting the change, which a design cannot
show, so the plugin does not test it. The
[line height](#body-text-lines-are-too-tight) check is a related readability
guideline: body text set below 1.3 is hard to read before any change.

### 1.4.4 Resize Text

[Success criterion 1.4.4](https://www.w3.org/TR/WCAG22/#resize-text) asks that
text can be enlarged to 200%. It sets no minimum size, so the
[12px](#text-is-smaller-than-12px) check is a guideline, not a WCAG test.

### Not covered yet

The audit does not check other WCAG criteria yet, among them the contrast of
icons and controls (1.4.11 Non-text Contrast), visible focus states (2.4.7) and
the size of touch targets (2.5.8).

## Token usage

A value bound to a variable or a style follows the design system: when the
palette, the spacing scale or the mode changes, the layer changes with it. A
hard-coded value stays as it was drawn. The token usage checks find those
values and suggest the variable or style to bind instead.

### Which properties are audited

| Property | Read from | Counts as bound when |
| --- | --- | --- |
| Fill | Each visible solid fill of a layer | It is bound to a colour variable, or the layer has a fill style. |
| Stroke | Each visible solid stroke of a layer with a stroke width | It is bound to a colour variable, or the layer has a stroke style. |
| Radius | The corner radius of frames, components and rectangles, when above 0 | It is bound to a variable. With different corners, each corner counts on its own. |
| Gap | The gap of an auto layout frame, when above 0 and not **Auto** (space between); with wrap, the gap between rows too | It is bound to a variable. |
| Padding | Each side of an auto layout frame, when above 0 | It is bound to a variable. |
| Font size | Each text layer | It has a text style, or its font size is bound to a variable. |

Gradients and images are not audited, nor are effects, stroke widths, sizes
and opacity.

A layer is left out, with everything inside it, when it is hidden or has
opacity 0. Also left out:

| Left out | Why |
| --- | --- |
| Instances and their content | Their properties come from the main component, which is audited where it is drawn. Overrides made on an instance are not audited. |
| Shapes inside a boolean operation | They only cut the outline; the boolean operation's own fill is audited. |
| Masks | They are not painted. |
| Sections | They organise the canvas and are not part of the design. Their content is audited. |
| Text whose characters have different fills or text styles | The value is mixed; the other properties of the layer are audited. |

### Which tokens are suggested

The suggestions come from the open file:

- local colour variables, for the fills and strokes their scopes allow;
- local number variables used as dimensions, for the radii, gaps, paddings and
  font sizes their scopes allow (the **Gap** scope covers padding too);
- local paint styles with a single solid paint, for fills and strokes;
- local text styles, by font size, for text.

A variable is matched against its value in every mode, so a hard-coded dark
colour on a dark frame finds the variable it was taken from. Variables from
libraries are not suggested.

A value matches a token:

- **exactly** when the colours are the same `#rrggbbaa`, or the dimensions are
  equal;
- **closely** when the colours look nearly the same (an
  [Oklab](https://bottosson.github.io/posts/oklab/) distance of at most 0.02,
  about the smallest difference the eye can see, with the same opacity), or the
  dimensions differ by at most 1px.

Of several matching tokens the plugin suggests an exact match before a close
one, then a semantic token before a primitive one, then a component token,
then a token whose name declares no layer. The layer is the first part of the
name, as on the Tokens tab: `primitive`, `semantic` or `component`, or their
plurals.

### Values are not bound to variables

<a id="hardcoded-value"></a>

**Warning.** The value of a property is hard-coded. The findings are split
into three cards:

- **Colours are not bound to variables**: fills and strokes.
- **Spacing and radii are not bound to variables**: gaps, paddings and radii.
- **Text has no text style**: font sizes.

Each row shows the property and its value, for example `Fill #2563eb` or
`Padding top 13px`, and below the layer path what to do:

| Note | Meaning |
| --- | --- |
| `Use semantic/accent` | A token has exactly this value. Bind it. |
| `Closest: spacing/4` | A token has a close value. The difference is most likely a mistake. |
| `No matching variable` | No token has a value near this one. The value is off the palette or the scale. |

The rows with an exact match come first, then the close ones.

Fix: bind the suggested variable or style. Round a value with no match to a
step of the scale, or add the missing token to the design system.

### Layers use primitive variables directly

<a id="primitive-binding"></a>

**Warning.** A property is bound to a primitive variable, such as
`primitive/blue/500`, although the file has semantic or component variables.
Primitives hold raw values; a layer bound to one does not say what the value
is for, and does not follow a mode that remaps the role.

The note names the primitive and, when there is one, the semantic variable
with the same value: `Bound to primitive/blue/500 · Use semantic/accent`.

The check runs only when the file has variables of a layer above primitive.
In a file with only primitives there is nothing better to bind.

Fix: bind the suggested semantic variable instead.

### Token coverage

The summary shows how much of the page is built from tokens:

```text
Token coverage 65%: 52 of 80 properties use variables or styles
```

Every audited property counts once, bound or not; a property bound to a
primitive counts as bound. The percentage is rounded down, so 100% means every
property is bound.

## Reading the results

### Accessibility block

The Accessibility block is shown when the scope has visible text.

* **Accessibility**: the score and grade of the text audit.
  See [The scores](#the-scores).
* **Fails WCAG AA until N errors are fixed**: the number of layers failing the
  contrast minimum.
  When there are none, the line reads **Text contrast meets WCAG AA**.
* **Errors**, **Warnings**, **Not checked**: the number of accessibility
  findings.
  Clicking a count filters only the Accessibility findings.
  Clicking the selected count again shows all Accessibility findings.

### Token usage block

The Token usage block is shown when the scope has at least one audited
property.

* **Token usage**: the score and grade of the token usage audit.
  See [The scores](#the-scores).
* **Token coverage**: see [Token coverage](#token-coverage).
* **Findings**: the number of token usage issues, affected properties and
  affected layers.

### Findings

**All**, **Errors**, **Warnings** and **Not checked** filter the findings. The
line on the right counts the shown issues and their layers; a layer with
several findings counts once.

Each finding is a card:

| Part | What it shows |
| --- | --- |
| Icon | Severity: a red circle for an error, an amber triangle for a warning, an outlined circle for not checked. |
| Title | The problem. |
| Count | How many layers have the problem; for token usage, how many properties. |
| Description | What the check requires, and the worst value found. |
| **Fix** | How to fix the problem. The advice is the same for every layer of the card. |
| Rows | One row per layer, worst first: the text layer icon, the layer name as in the layers panel (not the text it holds), the path of its parent frames and groups, outermost first, and the measured value. For token usage, one row per property, with the frame icon, the property and its value, and the token to use. |
| **Select** | Selects the layer in Figma and zooms to it, switching to its page when needed. |
| Footer | **Showing 5 of N** with **Show all** to list every row, and **Select all N** to select every layer of the card at once. |

## The scores

The tab shows two scores, one per category, because they answer different
questions. Neither is a WCAG conformance level: only the
[contrast check](#text-contrast-is-below-wcag-aa) is a WCAG criterion, and its
result is the **Fails WCAG AA** or **Text contrast meets WCAG AA** line.

### Accessibility

```text
accessibility = 100 - 2 x errors - 0.1 x warnings
```

The score is rounded and never goes below 0. Errors are text layers failing
the contrast minimum; warnings are text layers with
[small text](#text-is-smaller-than-12px) or
[tight lines](#body-text-lines-are-too-tight). Text that could not be checked
does not count. Token usage findings do not affect this score.

The score is shown when the scope has visible text.

### Token usage

```text
token usage = 100 x properties without findings / properties
```

The score is rounded down, so 100 means no finding at all. A property without
findings is bound to a variable or a style, and not to a
[primitive](#primitive-binding) where semantic variables exist. Unlike the
[token coverage](#token-coverage), which counts every bound property, the score
counts a primitive binding as a problem.

The score is shown when the scope has at least one audited property.

### Grades

Both scores use the same grades:

| Grade | Score |
| --- | --- |
| A | 90 and above |
| B | 80 to 89 |
| C | 70 to 79 |
| D | 60 to 69 |
| F | below 60 |

Each block has **How is the score calculated?**.
It shows that block's formula with the current numbers.
The number on the **Design** tab is the number of accessibility errors.

## Limitations

### Contrast

The background is found from layer geometry and fills, not from the rendered
image, so some setups are read wrongly:

- Only the point under the centre of the text is looked at. Text lying across
  two backgrounds is measured against one of them.
- The opacity of a parent group, blend modes, effects such as shadows and
  blurs, masks applied to the text, clipping and rotation are not taken into
  account.
- A layer's bounds are its bounding box, so an ellipse or a rotated shape counts
  as covering its whole box.

A `1.00:1` contrast on text that is visible on the canvas usually comes from
one of these. Check the layer with **Select**.

### Token usage

- Only tokens of the open file are suggested. A value matching a variable of
  a library is reported with **No matching variable**, and a layer bound to a
  library variable counts as bound.
- Overrides of instances are not audited: a colour changed on one instance is
  not reported.
- The layer of a variable or style is read from its name only. Names without
  a `primitive`, `semantic` or `component` prefix declare no layer, so the
  [primitive check](#primitive-binding) does not apply to them.
- A suggestion is chosen by value, not by meaning: two semantic variables with
  the same colour, such as a text and an icon colour, are equal candidates and
  the first by name is shown. Check that the suggested role fits.
- Text styles are matched by font size alone.
