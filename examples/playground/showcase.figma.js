/**
 * Builds a showcase page from the variables and styles of the open document.
 *
 * Run it in a Figma plugin that evaluates code, such as Scripter.
 *
 * The first two segments of a name choose the section, the last one labels the
 * entry:
 *
 *     primitive/color/*        -> Primitive colours
 *     primitive/dimension/*    -> Spacing scale, Corner radius
 *     primitive/number/*       -> Numbers
 *     semantic/color/*         -> Semantic colours
 *     component/**             -> Reference chains
 *
 * Component variables carry references, so they appear in the chains. The
 * showcase covers the three layers above and skips other names.
 *
 * Running it again replaces the previous showcase instead of stacking a second
 * copy next to it.
 */

const PAGE_NAME = "Tokens Showcase";

const LABEL_FONT = { family: "Inter", style: "Regular" };
const TITLE_FONT = { family: "Inter", style: "Semi Bold" };

const COLUMN_GAP = 32;
const COLUMN_WIDTH = 320;
const SECTION_GAP = 24;
const ITEM_GAP = 12;
const SWATCH_SIZE = 64;
const LABEL_SIZE = 11;
const TITLE_SIZE = 20;
const SECTION_SIZE = 14;

const INK = { r: 0.06, g: 0.09, b: 0.16 };
const MUTED = { r: 0.28, g: 0.33, b: 0.41 };
const SURFACE = { r: 1, g: 1, b: 1 };
const CANVAS = { r: 0.97, g: 0.98, b: 0.99 };
const HAIRLINE = { r: 0.8, g: 0.84, b: 0.88 };
const SHEET = { r: 0.93, g: 0.94, b: 0.96 };

async function buildShowcase() {
    await loadFonts();

    const variables = await readVariables();
    if (variables.length === 0) {
        printLine("No variables found. Run the token script first.");
        return;
    }

    const styles = {
        text: await figma.getLocalTextStylesAsync(),
        effect: await figma.getLocalEffectStylesAsync(),
    };

    const page = await resetPage();
    const sections = [
        colorSection(variables, "primitive", "Primitive colours"),
        colorSection(variables, "semantic", "Semantic colours"),
        scaleSection(variables, "space", "Spacing scale"),
        scaleSection(variables, "radius", "Corner radius"),
        numberSection(variables),
        typographySection(styles.text),
        shadowSection(styles.effect),
        aliasSection(variables),
    ].filter((section) => section !== undefined);

    layoutColumns(page, sections);
    figma.currentPage = page;

    printLine(
        "Showcase built: " + sections.length + " sections from "
        + variables.length + " variables, "
        + styles.text.length + " text styles, "
        + styles.effect.length + " effect styles.",
    );
}

/**
 * Reads the variables the showcase draws from.
 *
 * A name starting with a token layer marks a variable as part of the design
 * system; the filter keeps those.
 */
async function readVariables() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const byId = new Map(collections.map((entry) => [entry.id, entry]));
    const variables = await figma.variables.getLocalVariablesAsync();

    return variables
        .filter((variable) => /^(primitive|semantic|component)\//.test(variable.name))
        .map((variable) => {
            const collection = byId.get(variable.variableCollectionId);
            const modeId = collection ? collection.defaultModeId : undefined;

            return {
                variable,
                name: variable.name,
                segments: variable.name.split("/"),
                type: variable.resolvedType,
                description: variable.description || "",
                value: modeId === undefined ? undefined : variable.valuesByMode[modeId],
            };
        });
}

/**
 * Shows colours of one layer as bound swatches.
 *
 * The fill is bound to the variable rather than copied, so editing the variable
 * updates the swatch.
 */
function colorSection(variables, layer, title) {
    const entries = variables.filter(
        (entry) => entry.type === "COLOR" && entry.segments[0] === layer,
    );

    if (entries.length === 0) {
        return undefined;
    }

    const section = createSection(title, entries.length + " colours");

    for (const entry of entries) {
        const row = createRow();
        const swatch = figma.createRectangle();
        swatch.resize(SWATCH_SIZE, SWATCH_SIZE);
        swatch.cornerRadius = 8;
        swatch.fills = [bindColor(entry.variable)];
        swatch.strokes = [solid(HAIRLINE)];
        swatch.strokeWeight = 1;

        row.appendChild(swatch);
        appendFilling(row, captionBlock(leafName(entry), entry.description));
        appendFilling(section, row);
    }

    return section;
}

/**
 * Shows a numeric scale as bars whose width comes from the variable.
 *
 * Binding the width makes the proportion between steps visible at a glance.
 */
function scaleSection(variables, group, title) {
    const entries = variables.filter(
        (entry) => entry.type === "FLOAT"
            && entry.segments[0] === "primitive"
            && leafName(entry).startsWith(group + "-"),
    );

    if (entries.length === 0) {
        return undefined;
    }

    const section = createSection(title, entries.length + " steps");

    for (const entry of entries) {
        const row = createRow();
        const bar = figma.createRectangle();
        // A pill radius would run off the sheet, so the bar is capped.
        const width = Math.min(Math.max(Number(entry.value) || 1, 2), 320);
        bar.resize(width, 20);
        bar.cornerRadius = 4;
        bar.fills = [solid(INK)];

        row.appendChild(bar);
        appendFilling(row, captionBlock(leafName(entry), formatNumber(entry.value) + " px"));
        appendFilling(section, row);
    }

    return section;
}

/**
 * Lists plain numbers, which have no visual form of their own.
 */
function numberSection(variables) {
    const entries = variables.filter(
        (entry) => entry.type === "FLOAT"
            && entry.segments[0] === "primitive"
            && entry.segments[1] === "number",
    );

    if (entries.length === 0) {
        return undefined;
    }

    const section = createSection("Numbers", entries.length + " values");

    for (const entry of entries) {
        appendFilling(
            section,
            captionBlock(leafName(entry) + ": " + formatNumber(entry.value), entry.description),
        );
    }

    return section;
}

/**
 * Shows each text style applied to a sample line.
 */
function typographySection(styles) {
    if (styles.length === 0) {
        return undefined;
    }

    const section = createSection("Typography", styles.length + " text styles");

    for (const style of styles) {
        const sample = figma.createText();
        sample.fontName = LABEL_FONT;
        sample.characters = "The quick brown fox";
        sample.textStyleId = style.id;
        sample.fills = [solid(INK)];

        appendFilling(section, sample);
        appendFilling(section, caption(style.name, MUTED));
    }

    return section;
}

/**
 * Shows each effect style on a plain card, where a shadow reads clearly.
 */
function shadowSection(styles) {
    if (styles.length === 0) {
        return undefined;
    }

    const section = createSection("Shadows", styles.length + " effect styles");

    for (const style of styles) {
        const card = figma.createFrame();
        card.resize(220, 64);
        card.cornerRadius = 12;
        card.fills = [solid(SURFACE)];
        card.effectStyleId = style.id;

        section.appendChild(card);
        appendFilling(section, caption(style.name, MUTED));
    }

    return section;
}

/**
 * Shows the reference chain, which is what the layering is for.
 *
 * A component token pointing at a semantic one, in turn pointing at a
 * primitive, is the structure the whole set is built on.
 */
function aliasSection(variables) {
    const byId = new Map(variables.map((entry) => [entry.variable.id, entry]));
    const aliases = variables.filter((entry) => isAlias(entry.value));

    if (aliases.length === 0) {
        return undefined;
    }

    const section = createSection("Reference chains", aliases.length + " aliases");

    for (const entry of aliases.slice(0, 24)) {
        appendFilling(section, caption(entry.name + "  ->  " + chainOf(entry, byId), MUTED));
    }

    if (aliases.length > 24) {
        appendFilling(section, caption("and " + (aliases.length - 24) + " more", MUTED));
    }

    return section;
}

/** Follows an alias to the variable holding the raw value. */
function chainOf(entry, byId) {
    const seen = new Set();
    let current = entry;
    const steps = [];

    while (isAlias(current.value) && !seen.has(current.name)) {
        seen.add(current.name);
        const next = byId.get(current.value.id);
        if (next === undefined) {
            break;
        }

        steps.push(next.name);
        current = next;
    }

    return steps.join("  ->  ") || "unresolved";
}

function isAlias(value) {
    return value !== undefined && value !== null && value.type === "VARIABLE_ALIAS";
}

/**
 * Replaces the previous showcase page so a rerun does not stack copies.
 */
async function resetPage() {
    await figma.loadAllPagesAsync();

    const existing = figma.root.children.find((page) => page.name === PAGE_NAME);
    if (existing !== undefined) {
        for (const child of existing.children) {
            child.remove();
        }

        return existing;
    }

    const page = figma.createPage();
    page.name = PAGE_NAME;
    return page;
}

/**
 * Puts the sections in one auto layout row, so Figma spaces them itself.
 *
 * Positioning them by hand would need each section's width, which auto layout
 * only settles after its children do.
 */
function layoutColumns(page, sections) {
    const sheet = figma.createFrame();
    sheet.name = "Design tokens";
    sheet.layoutMode = "HORIZONTAL";
    sheet.primaryAxisSizingMode = "AUTO";
    sheet.counterAxisSizingMode = "AUTO";
    // Columns start at the top rather than stretching to the tallest one.
    sheet.counterAxisAlignItems = "MIN";
    sheet.itemSpacing = COLUMN_GAP;
    sheet.paddingLeft = COLUMN_GAP;
    sheet.paddingRight = COLUMN_GAP;
    sheet.paddingTop = COLUMN_GAP;
    sheet.paddingBottom = COLUMN_GAP;
    sheet.fills = [solid(SHEET)];

    page.appendChild(sheet);
    for (const section of sections) {
        sheet.appendChild(section);
    }

    return sheet;
}

/**
 * Creates one column of the sheet.
 *
 * Columns share a fixed width so they read as a grid; only the height follows
 * the content.
 */
function createSection(title, subtitle) {
    const frame = figma.createFrame();
    frame.name = title;
    frame.layoutMode = "VERTICAL";
    // Width is set first: resizing a frame whose height is already automatic
    // pins that height and stops it following the content.
    frame.resize(COLUMN_WIDTH, COLUMN_WIDTH);
    frame.counterAxisSizingMode = "FIXED";
    frame.primaryAxisSizingMode = "AUTO";
    frame.itemSpacing = ITEM_GAP;
    frame.paddingLeft = SECTION_GAP;
    frame.paddingRight = SECTION_GAP;
    frame.paddingTop = SECTION_GAP;
    frame.paddingBottom = SECTION_GAP;
    frame.cornerRadius = 12;
    frame.fills = [solid(CANVAS)];

    const heading = figma.createText();
    heading.fontName = TITLE_FONT;
    heading.fontSize = TITLE_SIZE;
    heading.characters = title;
    heading.fills = [solid(INK)];
    appendFilling(frame, heading);
    appendFilling(frame, caption(subtitle, MUTED, SECTION_SIZE));
    return frame;
}

/**
 * Creates a sample-and-label row spanning the column.
 */
function createRow() {
    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    // Both axes follow the content until the section stretches the row to the
    // column width.
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    row.counterAxisAlignItems = "CENTER";
    row.itemSpacing = ITEM_GAP;
    row.fills = [];
    return row;
}

/** A name with its description underneath, the pair every sample carries. */
function captionBlock(name, description) {
    const block = figma.createFrame();
    block.layoutMode = "VERTICAL";
    block.primaryAxisSizingMode = "AUTO";
    block.counterAxisSizingMode = "FIXED";
    block.itemSpacing = 2;
    block.fills = [];

    appendFilling(block, caption(name, INK, SECTION_SIZE));
    if (description) {
        appendFilling(block, caption(description, MUTED));
    }

    return block;
}

/**
 * Creates a line of text that grows downward rather than sideways.
 *
 * Width is set by `fillWidth` once the node has a parent, since auto layout
 * sizing can only be assigned to a child.
 */
function caption(text, color, size) {
    const node = figma.createText();
    node.fontName = LABEL_FONT;
    node.fontSize = size || LABEL_SIZE;
    node.characters = text;
    node.fills = [solid(color)];
    node.textAutoResize = "HEIGHT";
    return node;
}

function bindColor(variable) {
    return figma.variables.setBoundVariableForPaint(solid(SURFACE), "color", variable);
}

/**
 * Appends a child and makes it span its parent's width.
 *
 * Auto layout sizing is a property of a child, so it can only be set after the
 * node joins its parent.
 */
function appendFilling(parent, child) {
    parent.appendChild(child);
    child.layoutSizingHorizontal = "FILL";
    return child;
}

function solid(color) {
    return { type: "SOLID", color: color };
}

function leafName(entry) {
    return entry.segments[entry.segments.length - 1];
}

function formatNumber(value) {
    return typeof value === "number" ? String(Math.round(value * 1000) / 1000) : "-";
}

/**
 * Loads the fonts the labels need.
 *
 * Assigning text without loading its font throws, and a missing face should
 * stop the run with a clear message rather than midway through the sheet.
 */
async function loadFonts() {
    for (const font of [LABEL_FONT, TITLE_FONT]) {
        try {
            await figma.loadFontAsync(font);
        } catch (error) {
            throw new Error(
                "Font " + font.family + " " + font.style + " is unavailable. "
                + (error && error.message ? error.message : String(error)),
            );
        }
    }
}

/**
 * Writes one line of the report.
 *
 * Scripter shows values through its own `print` and leaves `console` output out
 * of sight, while a plugin has `console` and no `print`.
 */
function printLine(line) {
    if (typeof print === "function") {
        print(line);
        return;
    }

    console.log(line);
}

await buildShowcase();
