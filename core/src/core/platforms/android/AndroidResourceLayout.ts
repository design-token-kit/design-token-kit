import type { AndroidResource } from "#/core/platforms/android/AndroidResource";
import { resourceFileName } from "#/core/platforms/android/AndroidResourceType";

/**
 * Strategy deciding how resources are distributed across resource files.
 *
 * - `layer` - one file per root token group, e.g. `primitive.xml`,
 *   `semantic.xml`, `component.xml`, mirroring the token hierarchy
 * - `type` - one file per Android resource type, e.g. `colors.xml`,
 *   `dimens.xml`, following the Android naming convention
 */
export type AndroidResourceLayoutName = "layer" | "type";

/**
 * Resources belonging to one resource file.
 */
export interface AndroidResourceFile {
    /** File name inside the resource directory, e.g. `semantic.xml`. */
    readonly fileName: string;

    /** Resources the file holds, in document order. */
    readonly resources: ReadonlyArray<AndroidResource>;
}

/**
 * Distributes resources across resource files.
 */
export interface AndroidResourceLayout {
    /**
     * Splits resources into files.
     *
     * @param resources - Resources of one document, in document order.
     * @returns One entry per resource file.
     */
    split(resources: ReadonlyArray<AndroidResource>): ReadonlyArray<AndroidResourceFile>;
}

/**
 * Lays resources out by root token group, the design system layer, keeping
 * tokens that belong together in one file regardless of their resource type.
 */
export class AndroidLayerLayout implements AndroidResourceLayout {
    split(resources: ReadonlyArray<AndroidResource>): ReadonlyArray<AndroidResourceFile> {
        return groupBy(resources, (resource) => resource.group)
            .map(([group, grouped]) => ({ fileName: `${group}.xml`, resources: grouped }));
    }
}

/**
 * Lays resources out by Android resource type, following the conventional
 * `colors.xml` / `dimens.xml` file naming.
 */
export class AndroidTypeLayout implements AndroidResourceLayout {
    split(resources: ReadonlyArray<AndroidResource>): ReadonlyArray<AndroidResourceFile> {
        return groupBy(resources, (resource) => resource.type)
            .map(([type, grouped]) => ({ fileName: resourceFileName(type), resources: grouped }));
    }
}

/**
 * Creates the layout strategy for the given name.
 */
export function createResourceLayout(name: AndroidResourceLayoutName): AndroidResourceLayout {
    return name === "type" ? new AndroidTypeLayout() : new AndroidLayerLayout();
}

/**
 * Groups items by key, preserving both first-seen key order and item order.
 */
function groupBy<K, T>(items: ReadonlyArray<T>, key: (item: T) => K): Array<[K, T[]]> {
    const groups = new Map<K, T[]>();
    for (const item of items) {
        const group = groups.get(key(item));
        if (group) {
            group.push(item);
        } else {
            groups.set(key(item), [item]);
        }
    }
    return [...groups.entries()];
}
