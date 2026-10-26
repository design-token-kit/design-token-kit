/**
 * Returns true when a property inherits its value from the parent element by
 * default.
 *
 * Every custom property inherits.
 * The list of standard properties follows the "Inherited: yes" entries of the
 * CSS specifications for properties that design tokens commonly style.
 */
export function isInheritedProperty(property: string): boolean {
    return isCustomProperty(property) || INHERITED_PROPERTIES.has(property);
}

/**
 * Returns true when a property is a custom property, e.g. `--color-text`.
 */
export function isCustomProperty(property: string): boolean {
    return property.startsWith(CUSTOM_PROPERTY_PREFIX);
}

const CUSTOM_PROPERTY_PREFIX: string = "--";

const INHERITED_PROPERTIES: ReadonlySet<string> = new Set([
    "accent-color",
    "border-collapse",
    "border-spacing",
    "caption-side",
    "caret-color",
    "color",
    "color-scheme",
    "cursor",
    "direction",
    "empty-cells",
    "fill",
    "fill-opacity",
    "font",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-optical-sizing",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-variant",
    "font-variant-alternates",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variant-position",
    "font-variation-settings",
    "font-weight",
    "hyphens",
    "letter-spacing",
    "line-break",
    "line-height",
    "list-style",
    "list-style-image",
    "list-style-position",
    "list-style-type",
    "orphans",
    "overflow-wrap",
    "paint-order",
    "pointer-events",
    "print-color-adjust",
    "quotes",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-opacity",
    "stroke-width",
    "tab-size",
    "text-align",
    "text-align-last",
    "text-decoration-skip-ink",
    "text-indent",
    "text-rendering",
    "text-shadow",
    "text-transform",
    "text-underline-offset",
    "text-underline-position",
    "text-wrap",
    "visibility",
    "white-space",
    "widows",
    "word-break",
    "word-spacing",
    "writing-mode",
]);
