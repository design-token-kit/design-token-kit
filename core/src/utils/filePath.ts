/**
 * Returns the last path segment of a file name, so a dot in a directory name
 * is not mistaken for part of the file name.
 *
 * Both separators are handled, because a path may come from a caller on either
 * platform rather than from this one.
 */
export function lastSegmentOf(fileName: string): string {
    return fileName.slice(Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\")) + 1);
}
