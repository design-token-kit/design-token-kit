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
    AndroidTokenConverter,
    type AndroidResourceLayoutName,
} from "@design-token-kit/core";
import type { Command } from "commander";

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

    /**
     * Android: how resources are split across files, either `layer` for one
     * file per root token group or `type` for one file per Android resource
     * type. Any other value is rejected.
     *
     * @defaultValue `"layer"`
     */
    androidLayout?: string;

    /**
     * Android and SwiftUI: pixel base resolving `rem` dimensions, which these
     * platforms do not support. Must be a positive number. Overrides the base
     * declared by the token document.
     *
     * @defaultValue `"16"`
     */
    remBase?: string;
}

interface FormatOptionDefinition {
    readonly key: keyof ConvertSettings;
    readonly flags: string;
    readonly name: string;
    readonly description: string;
    readonly formats: readonly OutputFormat[];
}

const FORMAT_OPTION_DEFINITIONS: readonly FormatOptionDefinition[] = [
    {
        key: "separator",
        flags: "--separator [value]",
        name: "--separator",
        description: "SCSS only: character used to replace '.' in token paths when generating variable names (default: -)",
        formats: [Format.SCSS],
    },
    {
        key: "baseSelector",
        flags: "--base-selector [selector]",
        name: "--base-selector",
        description: "Tailwind v4 only: selector for optional mirrored base custom properties",
        formats: [Format.TAILWIND_V4],
    },
    {
        key: "themeSelector",
        flags: "--theme-selector [template]",
        name: "--theme-selector",
        description: "Tailwind v4 only: selector template for theme overrides with {theme} placeholder",
        formats: [Format.TAILWIND_V4],
    },
    {
        key: "swiftType",
        flags: "--swift-type [type]",
        name: "--swift-type",
        description: "SwiftUI only: output form 'enum' or 'struct' (default: enum)",
        formats: [Format.SWIFT_UI],
    },
    {
        key: "androidLayout",
        flags: "--android-layout [layout]",
        name: "--android-layout",
        description: "Android only: file layout 'layer' or 'type' (default: layer)",
        formats: [Format.ANDROID],
    },
    {
        key: "remBase",
        flags: "--rem-base [pixels]",
        name: "--rem-base",
        description: "Android and SwiftUI only: pixel base used to resolve rem dimensions (default: 16)",
        formats: [Format.ANDROID, Format.SWIFT_UI],
    },
];

/**
 * Adds all format-specific convert options to the command.
 */
export function addFormatOptions(command: Command): void {
    for (const option of FORMAT_OPTION_DEFINITIONS) {
        command.option(option.flags, option.description);
    }
}

/**
 * Rejects options that do not belong to the selected output format.
 */
export function validateFormatOptions(outform: string | undefined, settings: ConvertSettings): void {
    const outputFormat = toOutputFormat(outform);
    for (const option of FORMAT_OPTION_DEFINITIONS) {
        if (settings[option.key] === undefined || option.formats.includes(outputFormat)) {
            continue;
        }

        const expectedFormats = option.formats.map((format) => `"${format}"`).join(" or ");
        throw new Error(`${option.name} is only valid for ${expectedFormats}; got "${outputFormat}"`);
    }
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
            remBase: toRemBase(settings.remBase),
        }).convertList(list),
    },
    [Format.FIGMA_SCRIPT]: {
        themes: true,
        write: (list) => new FigmaScriptTokenConverter().convertList(list),
    },
    [Format.ANDROID]: {
        // Android output normally spans several resource files, which the
        // convert command writes itself. A writer only serves the single-file
        // case, so it takes the base document alone.
        themes: false,
        write: (list, settings) => new AndroidTokenConverter({
            layout: toAndroidLayout(settings.androidLayout),
            remBase: toRemBase(settings.remBase),
        }).convertDocument(list.base),
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

export function toAndroidLayout(layout?: string): AndroidResourceLayoutName | undefined {
    if (layout === undefined) {
        return undefined;
    }

    if (layout === "layer" || layout === "type") {
        return layout;
    }

    throw new Error(`Unknown --android-layout "${layout}", use layer or type`);
}

export function toRemBase(remBase?: string): number | undefined {
    if (remBase === undefined) {
        return undefined;
    }

    const parsed = Number(remBase);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --rem-base "${remBase}", use a positive number`);
    }

    return parsed;
}
