import {
    Dtcg,
    DtcgList,
    DtcgTokenCssConverter,
    DtcgToDesignMdMapper,
    DtcgJsonReader,
    DtcgJsonWriter,
    Format,
    HrdtTokenReader,
    HrdtTokenWriter,
    DesignMdReader,
    DesignMdWriter,
    DtcgTailwindCssConverter,
} from "@design-token-kit/core";

export { Format };

export type DocumentFormat = Format.DTCG | Format.HRDT | Format.DESIGN_MD;
export type OutputFormat = Format;

export function getReader(format?: string): DocumentReader {
    return readers[toDocumentFormat(format)];
}

export function getWriter(format?: string): DocumentWriter {
    return writers[toOutputFormat(format)];
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
        write: (doc) => {
            // DTCG tree (primitive/semantic/component) must be flattened
            // to DESIGN.md layout (colors/typography/rounded/spacing/components)
            const mapped = new DtcgToDesignMdMapper().map(new DtcgList(doc));
            return new DesignMdWriter().write(mapped.base);
        },
    },
    [Format.CSS]: {
        write: (doc) => new DtcgTokenCssConverter().convertDocument(doc),
    },
    [Format.TAILWIND_V4]: {
        write: (doc) => new DtcgTailwindCssConverter().convertDocument(doc),
    },
} satisfies Record<OutputFormat, DocumentWriter>;

export function toDocumentFormat(format?: string, fallback = Format.DTCG): DocumentFormat {
    const resolved = format ?? fallback;
    if (resolved === Format.DTCG || resolved === Format.HRDT || resolved === Format.DESIGN_MD) return resolved;
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.DESIGN_MD}`);
}

function toOutputFormat(format?: string, fallback = Format.CSS): OutputFormat {
    const resolved = format === "tailwind" ? Format.TAILWIND_V4 : format ?? fallback;
    if (
        resolved === Format.DTCG
        || resolved === Format.HRDT
        || resolved === Format.DESIGN_MD
        || resolved === Format.CSS
        || resolved === Format.TAILWIND_V4
    ) {
        return resolved;
    }
    throw new Error(`Unknown format "${resolved}". Available: ${Format.DTCG}, ${Format.HRDT}, ${Format.DESIGN_MD}, ${Format.CSS}, ${Format.TAILWIND_V4}`);
}
