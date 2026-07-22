export function existsSync(): boolean {
    throw new Error("node:fs is not available in the Figma plugin runtime.");
}
