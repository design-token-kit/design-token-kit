/**
 * Android resource types produced by token conversion.
 *
 * @see https://developer.android.com/guide/topics/resources/more-resources
 */
export enum AndroidResourceType {

    /** Color resource, rendered as `<color>` in `colors.xml`. */
    COLOR = "color",

    /** Dimension resource, rendered as `<dimen>` in `dimens.xml`. */
    DIMEN = "dimen",

    /** Integer resource, rendered as `<integer>` in `integers.xml`. */
    INTEGER = "integer",

    /**
     * Fractional number resource, rendered as a float `<item>` in
     * `floats.xml`. Android has no `<float>` element, so unitless fractional
     * values use a typed item declaration.
     */
    FLOAT = "float",

    /** String resource, rendered as `<string>` in `strings.xml`. */
    STRING = "string",
}

/** Resource file name for each resource type. */
const FILE_NAMES: Record<AndroidResourceType, string> = {
    [AndroidResourceType.COLOR]: "colors.xml",
    [AndroidResourceType.DIMEN]: "dimens.xml",
    [AndroidResourceType.INTEGER]: "integers.xml",
    [AndroidResourceType.FLOAT]: "floats.xml",
    [AndroidResourceType.STRING]: "strings.xml",
};

/** Returns the resource file name holding resources of the given type. */
export function resourceFileName(type: AndroidResourceType): string {
    return FILE_NAMES[type];
}
