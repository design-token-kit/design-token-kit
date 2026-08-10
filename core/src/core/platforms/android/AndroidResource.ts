import type { AndroidResourceType } from "#/core/platforms/android/AndroidResourceType";

/**
 * One generated Android resource entry.
 */
export interface AndroidResource {
    /** Resource type, deciding both the XML element and the target file. */
    readonly type: AndroidResourceType;

    /** Resource name in Android `snake_case` convention. */
    readonly name: string;

    /**
     * Name of the root token group the resource originates from, used to lay
     * resources out by token group.
     */
    readonly group: string;

    /**
     * Token group the resource is filed under inside its file, as a dotted
     * path. Empty for resources with no group of their own.
     */
    readonly section: string;

    /** Description of the section group, rendered as a section header. */
    readonly sectionDescription?: string;

    /** Resource body, either a literal or an `@type/name` reference. */
    readonly value: string;

    /** Token description, rendered as an XML comment. */
    readonly description?: string;
}
