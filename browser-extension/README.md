# Design Token Kit Inspector

Chromium Side Panel that traces authored CSS custom properties on a selected
element to Design Token Kit design tokens.

## Build and install

Run `npm run build --workspace @design-token-kit/browser-extension`.

Open `chrome://extensions`, enable developer mode, select "Load unpacked", and
choose `browser-extension/dist`.

Open the extension from the toolbar to show the Side Panel.

## Use

Generate CSS and a token map together:

```shell
dtokens convert tokens.json --out tokens.css --css-token-map
```

The panel discovers the map from `--dtokens-map` in the generated CSS.

You can enter the map URL manually when automatic discovery is unavailable.

Select "Pick element", then select an element on the page.

The panel shows the token chains found in its authored CSS declarations.

Literal properties are hidden by default.

Enable "Show literal properties" when checking authored values that do not use
tokens.

Click a token path to copy it.

Use "Copy chain" to copy the complete reference chain.

## Permissions

The extension requests the `debugger` permission to query Chrome DevTools
Protocol for the real CSS cascade.

Chrome displays its debugger notification while the picker is active.

The extension requests host access so it can load a published token map.

## Current limitations

* The extension is a Side Panel rather than a DevTools tab because Chrome does
  not allow an extension debugger session and DevTools to inspect the same tab.
* Pseudo-elements and closed shadow roots are not supported.
* The cascade order is supplied by Chrome DevTools Protocol.
  Registered custom property semantics and CSS-wide keywords are not yet
  modelled by the tracer.
