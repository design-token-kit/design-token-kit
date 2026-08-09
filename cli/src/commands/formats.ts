import {
    Dtcg,
    DtcgList,
    CssTokenConverter,
    ScssTokenConverter,
    DtcgToDesignMdMapper,
    DtcgJsonReader,
    DtcgJsonWriter,
    Format,
    HrdtTokenReader,
    HrdtTokenWriter,
    DesignMdReader,
    DesignMdWriter,
    TailwindTokenConverter,
    FigmaScriptTokenConverter,
    SwiftUiTokenConverter,
} from "@design-token-kit/core";

export { Format };

export type DocumentFormat = Format.DTCG | Format.HRDT | Format.DESIGN_MD;
export type OutputFormat = Format;

/**
 * Format-specific settings a converter may read.
 *
 * Every field belongs to one format; a converter ignores the rest.
 */
export interface ConvertSettings {
    /**
     * SCSS: character replacing `.` in a token path when building a variable
     * name, so `color.brand` becomes `$color-brand`.
     *
     * @defaultValue `"-"`
     */
    separator?: string;

    /**
     * Tailwind v4: selector mirroring the base custom properties outside the
     * `@theme` block, needed when a shadow root has to see them.
     *
     * @defaultValue no mirror is emitted
     */
    baseSelector?: string;

    /**
     * Tailwind v4: selector template for theme overrides, where `{theme}`
     * stands for the theme name.
     *
     * @defaultValue `"[data-theme='{theme}']"`
     */
    themeSelector?: string;

    /**
     * SwiftUI: output form, either `enum` for nested namespaces or `struct`
     * for an additional `Theme` struct layer. Any other value is rejected.
     *
     * @defaultValue `"enum"`
     */
    swiftType?: string;
}

export function getReader(format?: string): DocumentReader {
    return readers[toDocumentFormat(format)];
}

export function getWriter(format?: string): DocumentWriter {
    return writers[toOutputFormat(format)];
}

/**
 * Parses token source text in one input format.
 */
interface DocumentReader {
    /**
     * Parses source text into a token document.
     *
     * @param content - Token source text.
     * @returns Parsed DTCG document.
     */
    read(content: string): Dtcg;
}

/**
 * Writes a token document in one output format.
 */
export interface DocumentWriter {
    /**
     * Whether the format expresses a base document plus theme overrides.
     *
     * @remarks
     * A writer states this itself, so the caller does not have to track which
     * formats accept more than one document.
     */
    readonly themes: boolean;

    /**
     * Writes a base document and its theme overrides.
     *
     * @param list - Base document and named theme overrides. A writer that
     * reports no theme support receives the base document alone.
     * @param settings - Format-specific settings from the command line.
     * @returns Generated source.
     */
    write(list: DtcgList, settings: ConvertSettings): string;
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
        themes: false,
        write: (list) => new DtcgJsonWriter().write(list.base),
    },
    [Format.HRDT]: {
        themes: false,
        write: (list) => new HrdtTokenWriter().write(list.base),
    },
    [Format.DESIGN_MD]: {
        themes: false,
        write: (list) => {
            // DTCG tree (primitive/semantic/component) must be flattened
            // to DESIGN.md layout (colors/typography/rounded/spacing/components)
            const mapped = new DtcgToDesignMdMapper().map(new DtcgList(list.base));
            return new DesignMdWriter().write(mapped.base);
        },
    },
    [Format.CSS]: {
        themes: true,
        write: (list) => new CssTokenConverter().convertList(list),
    },
    [Format.SCSS]: {
        themes: true,
        write: (list, settings) => new ScssTokenConverter({
            separator: settings.separator,
        }).convertList(list),
    },
    [Format.TAILWIND_V4]: {
        themes: true,
        write: (list, settings) => new TailwindTokenConverter({
            baseSelector: settings.baseSelector,
            themeSelector: settings.themeSelector,
        }).convertList(list),
    },
    [Format.SWIFT_UI]: {
        themes: true,
        write: (list, settings) => new SwiftUiTokenConverter({
            swiftType: toSwiftType(settings.swiftType),
        }).convertList(list),
    },
    [Format.FIGMA_SCRIPT]: {
        themes: true,
        write: (list) => new FigmaScriptTokenConverter().convertList(list),
    },
} satisfies Record<OutputFormat, DocumentWriter>;

export function toDocumentFormat(format?: string, fallback = Format.DTCG): DocumentFormat {
    const resolved = format ?? fallback;
    if (resolved in readers) {
        return resolved as DocumentFormat;
    }

    throw new Error(`Unknown format "${resolved}". Available: ${Object.keys(readers).join(", ")}`);
}

function toOutputFormat(format?: string, fallback = Format.CSS): OutputFormat {
    const resolved = format === TAILWIND_ALIAS ? Format.TAILWIND_V4 : format ?? fallback;
    if (resolved in writers) {
        return resolved as OutputFormat;
    }

    throw new Error(`Unknown format "${resolved}". Available: ${Object.keys(writers).join(", ")}`);
}

/**
 * Legacy spelling of the Tailwind format, kept working for existing scripts.
 */
const TAILWIND_ALIAS = "tailwind";

function toSwiftType(swiftType?: string): "enum" | "struct" | undefined {
    if (swiftType === undefined) {
        return undefined;
    }

    if (swiftType === "enum" || swiftType === "struct") {
        return swiftType;
    }

    throw new Error(`Unknown --swift-type "${swiftType}", use enum or struct`);
}
