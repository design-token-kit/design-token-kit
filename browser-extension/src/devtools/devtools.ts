// DevTools page entry point: registers the Tokens pane in the Elements panel.

const PANE_TITLE = "Tokens";

const PANE_PAGE = "panel.html";

chrome.devtools.panels.elements.createSidebarPane(PANE_TITLE, (pane: chrome.devtools.panels.ExtensionSidebarPane) => {
    pane.setPage(PANE_PAGE);
});
