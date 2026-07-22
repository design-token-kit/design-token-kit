export async function readFile(): Promise<string> {
    throw new Error("node:fs/promises is not available in the Figma plugin runtime.");
}

export async function readdir(): Promise<never[]> {
    throw new Error("node:fs/promises is not available in the Figma plugin runtime.");
}

export async function writeFile(): Promise<void> {
    throw new Error("node:fs/promises is not available in the Figma plugin runtime.");
}
