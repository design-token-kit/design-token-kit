import {
    Dtcg,
    DtcgTokenCssConverter,
    DtcgJsonReader,
    DtcgJsonWriter,
    HrdtTokenReader,
    HrdtTokenWriter,
    DesignMdReader,
    DesignMdWriter,
} from "@design-token-kit/core";

export enum Format {
    DTCG = "dtcg",
    HRDT = "hrdt",
    DESIGN_MD = "design-md",
    CSS = "css",
}

export type DocumentFormat = Format.DTCG | Format.HRDT | Format.DESIGN_MD;
export type OutputFormat = Format;

export function detectDocumentFormat(file: string): DocumentFormat {
    if (/\.design\.md$/i.test(file) || /\.md$/i.test(file)) return Format.DESIGN_MD;
    if (/\.(ya?ml)$/i.test(file)) return Format.HRDT;
    return Format.DTCG;
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
    [Format.DESIGN_MD]: {
        read: (content) => new DesignMdReader().parse(content),
    },
} satisfies Record<DocumentFormat, DocumentReader>;

const writers = {
    [Format.DTCG]: {
        write: (doc) => new DtcgJsonWriter().write(doc),
    },
    [Format.HRDT]: {
        write: (doc) => new HrdtTokenWriter().write(doc),
    },
    [Format.DESIGN_MD]: {
        write: (doc) => new DesignMdWriter().write(doc),
    },
    [Format.CSS]: {
        write: (doc) => new DtcgTokenCssConverter().convertDocument(doc),
    },
} satisfies Record<OutputFormat, DocumentWriter>;

export function toDocumentFormat(format?: string, fallback = Format.DTCG): DocumentFormat {
    const resolved = format ?? fallback;
    if (resolved === Format.DTCG || resolved === Format.HRDT || resolved === Format.DESIGN_MD) return resolved;
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.DESIGN_MD}`);
}

function toOutputFormat(format?: string, fallback = Format.CSS): OutputFormat {
    const resolved = format ?? fallback;
    if (resolved === Format.DTCG || resolved === Format.HRDT || resolved === Format.DESIGN_MD || resolved === Format.CSS) return resolved;
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.DESIGN_MD}, ${Format.CSS}`);
}
