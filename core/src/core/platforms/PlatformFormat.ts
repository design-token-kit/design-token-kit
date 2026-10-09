/**
 * A platform source that tokens can be generated into.
 *
 * These are outputs: a converter writes them, nothing reads them back. CSS is
 * the one shared with {@link TokenFormat}, since the showcase also accepts CSS
 * as input; the two names carry the same value so they compare equal.
 *
 * The values are the names the CLI accepts, so they are part of the public
 * contract.
 */
export enum PlatformFormat {

    /**
     * CSS custom properties.
     */
    CSS = "css",

    /**
     * SCSS variables.
     */
    SCSS = "scss",

    /**
     * Tailwind CSS v4 theme variables.
     */
    TAILWIND_V4 = "tailwind-v4",

    /**
     * SwiftUI design tokens (namespaced enum of static let).
     */
    SWIFT_UI = "swiftui",

    /**
     * Figma script creating variables and styles through the Plugin API.
     */
    FIGMA_SCRIPT = "figma-script",

    /**
     * Android resource XML (`res/values` colors, dimens, integers, strings).
     */
    ANDROID = "android",
}
