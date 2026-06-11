import {
    Dtcg,
    DtcgTokenCssConverter,
    DtcgJsonReader,
    DtcgJsonWriter,
    HrdtTokenReader,
    HrdtTokenWriter,
} from "@design-token-kit/core";

export enum Format {
    DTCG = "dtcg",
    HRDT = "hrdt",
    CSS = "css",
}

export type DocumentFormat = Format.DTCG | Format.HRDT;
export type OutputFormat = Format;

export function detectDocumentFormat(file: string): DocumentFormat {
    return /\.(ya?ml)$/i.test(file) ? Format.HRDT : Format.DTCG;
}

export function getReader(format?: string): DocumentReader {
    return readers[toDocumentFormat(format)];
}

export function getWriter(format?: string): DocumentWriter {
    return writers[toOutputFormat(format)];
}

export function getDetectedReader(file: string): DocumentReader {
    return readers[detectDocumentFormat(file)];
}

interface DocumentReader {
    read(content: string): Dtcg;
}

interface DocumentWriter {
    write(doc: Dtcg): string;
}

const readers = {
    [Format.DTCG]: {
        read: (content) => new DtcgJsonReader().parse(content),
    },
    [Format.HRDT]: {
        read: (content) => new HrdtTokenReader().parse(content),
    },
} satisfies Record<DocumentFormat, DocumentReader>;

const writers = {
    [Format.DTCG]: {
        write: (doc) => new DtcgJsonWriter().write(doc),
    },
    [Format.HRDT]: {
        write: (doc) => new HrdtTokenWriter().write(doc),
    },
    [Format.CSS]: {
        write: (doc) => new DtcgTokenCssConverter().convertDocument(doc),
    },
} satisfies Record<OutputFormat, DocumentWriter>;

function toDocumentFormat(format?: string, fallback = Format.DTCG): DocumentFormat {
    const resolved = format ?? fallback;
    if (resolved === Format.DTCG || resolved === Format.HRDT) return resolved;
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}`);
}

function toOutputFormat(format?: string, fallback = Format.CSS): OutputFormat {
    const resolved = format ?? fallback;
    if (resolved === Format.DTCG || resolved === Format.HRDT || resolved === Format.CSS) return resolved;
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.CSS}`);
}
