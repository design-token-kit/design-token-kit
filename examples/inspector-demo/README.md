# Token inspector demo

A page for checking the browser extension by hand.

Regenerate the CSS and the CSS token map from the repository root:

    npm run dtokens -- convert core/test/core/css/fixtures/tokens.json \
        core/test/core/css/fixtures/tokens.dark.json \
        --out examples/inspector-demo/tokens.css --css-token-map

Serve the directory over HTTP, for example `npx serve examples/inspector-demo`,
and open it in Chromium with the extension loaded.
In the Tokens pane, load `tokens.css.map.json` from this directory.
