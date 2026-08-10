/**
 * Writes tar archives.
 *
 * The CLI packs multi-theme output into an archive.
 * Tar is the one format every platform unpacks without an extra tool.
 * Only the pieces the CLI needs are implemented: regular files.
 * Directories, links and long names are out of scope.
 *
 * @see https://www.gnu.org/software/tar/manual/html_node/Standard.html
 */

/**
 * A file to place in the archive.
 */
export interface TarEntry {

    /**
     * Path recorded in the archive.
     *
     * The ustar name field holds at most 100 bytes.
     * Longer paths are truncated.
     */
    name: string;

    /**
     * Bytes stored for this file.
     */
    content: Buffer;
}

/**
 * Builds an archive that any tar reader unpacks into the given files.
 *
 * Entries keep the given order.
 * The same entries always produce the same bytes, because the header
 * carries a fixed timestamp instead of the current time.
 *
 * @param entries - Files to archive.
 * @returns The archive bytes.
 */
export function createTarArchive(entries: ReadonlyArray<TarEntry>): Buffer {
    const blocks: Buffer[] = [];

    for (const entry of entries) {
        blocks.push(createHeader(entry.name, entry.content.length));
        blocks.push(entry.content);
        blocks.push(createContentPadding(entry.content.length));
    }
    blocks.push(createTrailer());

    return Buffer.concat(blocks);
}

/**
 * Every field and file in a tar archive is aligned to a block.
 */
const BLOCK_SIZE = 512;

/**
 * An archive ends with two zero-filled blocks.
 */
const TRAILING_BLOCKS = 2;

/**
 * Byte offsets and widths of the ustar header fields this writer fills.
 */
const FIELD = {
    name: { offset: 0, length: 100 },
    mode: { offset: 100, length: 8 },
    uid: { offset: 108, length: 8 },
    gid: { offset: 116, length: 8 },
    size: { offset: 124, length: 12 },
    modifiedAt: { offset: 136, length: 12 },
    checksum: { offset: 148, length: 8 },
    typeFlag: { offset: 156, length: 1 },
    magic: { offset: 257, length: 6 },
    version: { offset: 263, length: 2 },
};

/**
 * Position and width of a single header field.
 */
interface Field {
    offset: number;
    length: number;
}

/**
 * Permissions recorded for every archived file.
 */
const FILE_MODE = 0o644;

/**
 * The CLI archives its own output, so ownership carries no meaning.
 */
const ROOT_ID = 0;

/**
 * A fixed timestamp keeps the archive identical between runs.
 */
const FIXED_TIMESTAMP = 0;

/**
 * The ustar type flag for a regular file.
 */
const REGULAR_FILE = "0";

/**
 * Format name and version identifying a ustar header.
 */
const USTAR_MAGIC = "ustar";
const USTAR_VERSION = "00";

/**
 * The byte that fills the checksum field while the sum is taken.
 */
const SPACE = 0x20;

/**
 * Builds the header block preceding a file.
 *
 * The checksum covers the whole header including its own field.
 * That field therefore holds spaces while the sum is taken and
 * receives the result afterwards.
 */
function createHeader(name: string, size: number): Buffer {
    const header = Buffer.alloc(BLOCK_SIZE);

    writeString(header, FIELD.name, name);
    writeOctal(header, FIELD.mode, FILE_MODE);
    writeOctal(header, FIELD.uid, ROOT_ID);
    writeOctal(header, FIELD.gid, ROOT_ID);
    writeOctal(header, FIELD.size, size);
    writeOctal(header, FIELD.modifiedAt, FIXED_TIMESTAMP);
    writeString(header, FIELD.typeFlag, REGULAR_FILE);
    writeString(header, FIELD.magic, USTAR_MAGIC);
    writeString(header, FIELD.version, USTAR_VERSION);
    fillWithSpaces(header, FIELD.checksum);

    writeString(header, FIELD.checksum, toChecksumField(header));
    return header;
}

/**
 * Builds the zero bytes that extend content to a whole number of blocks.
 *
 * Content filling its last block needs no padding.
 */
function createContentPadding(contentLength: number): Buffer {
    const remainder = contentLength % BLOCK_SIZE;
    return remainder === 0
        ? Buffer.alloc(0)
        : Buffer.alloc(BLOCK_SIZE - remainder);
}

/**
 * Builds the zero blocks marking the end of the archive.
 */
function createTrailer(): Buffer {
    return Buffer.alloc(BLOCK_SIZE * TRAILING_BLOCKS);
}

/**
 * Renders the header checksum the way tar readers expect it.
 *
 * The octal digits are closed by a NUL byte and a space.
 */
function toChecksumField(header: Buffer): string {
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    return `${checksum.toString(8).padStart(6, "0")}\0 `;
}

/**
 * Writes text into a field, truncating what does not fit.
 */
function writeString(target: Buffer, field: Field, value: string): void {
    target.write(
        value.slice(0, field.length),
        field.offset,
        Math.min(field.length, Buffer.byteLength(value)),
        "utf8",
    );
}

/**
 * Writes a number into a field as octal digits closed by a NUL byte.
 */
function writeOctal(target: Buffer, field: Field, value: number): void {
    const digits = value.toString(8).padStart(field.length - 1, "0");
    writeString(target, field, `${digits}\0`);
}

/**
 * Blanks a field so it does not disturb the checksum being computed.
 */
function fillWithSpaces(target: Buffer, field: Field): void {
    target.fill(SPACE, field.offset, field.offset + field.length);
}
