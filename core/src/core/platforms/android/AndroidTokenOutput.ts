/**
 * One generated Android resource file.
 */
export interface AndroidTokenOutput {
    /**
     * Theme name associated with the file.
     *
     * Base document output always uses {@code "base"}.
     */
    readonly themeName: string;

    /**
     * Whether this file was generated from the base token document.
     */
    readonly isBase: boolean;

    /**
     * File path relative to the Android resource root, e.g.
     * {@code "values/colors.xml"} or {@code "values-night/colors.xml"}.
     */
    readonly filePath: string;

    /**
     * Generated XML content of the resource file.
     */
    readonly content: string;
}
