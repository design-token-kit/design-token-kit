import type { Command } from "commander";
import {
    DtcgList,
    CssTokenConverter,
    ScssTokenConverter,
    TokenFormat,
    PlatformFormat,
    tokenFormats,
    TailwindTokenConverter,
    FigmaScriptTokenConverter,
    SwiftUiTokenConverter,
    AndroidTokenConverter,
    type AndroidResourceLayoutName,
} from "@design-token-kit/core";

export { TokenFormat, PlatformFormat };

export type OutputFormat = TokenFormat | PlatformFormat;

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
     * Android: pixel base resolving `rem` dimensions, which Android does not
     * support. Must be a positive number.
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
        formats: [PlatformFormat.SCSS],
    },
    {
        key: "baseSelector",
        flags: "--base-selector [selector]",
        name: "--base-selector",
        description: "Tailwind v4 only: selector for optional mirrored base custom properties",
        formats: [PlatformFormat.TAILWIND_V4],
    },
    {
        key: "themeSelector",
        flags: "--theme-selector [template]",
        name: "--theme-selector",
        description: "Tailwind v4 only: selector template for theme overrides with {theme} placeholder",
        formats: [PlatformFormat.TAILWIND_V4],
    },
    {
        key: "swiftType",
        flags: "--swift-type [type]",
        name: "--swift-type",
        description: "SwiftUI only: output form 'enum' or 'struct' (default: enum)",
        formats: [PlatformFormat.SWIFT_UI],
    },
    {
        key: "androidLayout",
        flags: "--android-layout [layout]",
        name: "--android-layout",
        description: "Android only: file layout 'layer' or 'type' (default: layer)",
        formats: [PlatformFormat.ANDROID],
    },
    {
        key: "remBase",
        flags: "--rem-base [pixels]",
        name: "--rem-base",
        description: "Android and SwiftUI only: pixel base used to resolve rem dimensions (default: 16)",
        formats: [PlatformFormat.ANDROID, PlatformFormat.SWIFT_UI],
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

export function getWriter(format?: string): DocumentWriter {
    return writers[toOutputFormat(format)];
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

/**
 * Writers for the token formats, taken from their descriptors so the CLI does
 * not restate what each format already declares. None of them expresses themes:
 * a token document holds one set.
 */
const tokenWriters: Record<TokenFormat, DocumentWriter> = {
    [TokenFormat.DTCG]: tokenWriter(TokenFormat.DTCG),
    [TokenFormat.HRDT]: tokenWriter(TokenFormat.HRDT),
    [TokenFormat.DESIGN_MD]: tokenWriter(TokenFormat.DESIGN_MD),
};

function tokenWriter(format: TokenFormat): DocumentWriter {
    return {
        themes: false,
        write: (list) => tokenFormats.get(format).createWriter().write(list.base),
    };
}

const writers = {
    ...tokenWriters,
    [PlatformFormat.CSS]: {
        themes: true,
        write: (list) => new CssTokenConverter().convertList(list),
    },
    [PlatformFormat.SCSS]: {
        themes: true,
        write: (list, settings) => new ScssTokenConverter({
            separator: settings.separator,
        }).convertList(list),
    },
    [PlatformFormat.TAILWIND_V4]: {
        themes: true,
        write: (list, settings) => new TailwindTokenConverter({
            baseSelector: settings.baseSelector,
            themeSelector: settings.themeSelector,
        }).convertList(list),
    },
    [PlatformFormat.SWIFT_UI]: {
        themes: true,
        write: (list, settings) => new SwiftUiTokenConverter({
            swiftType: toSwiftType(settings.swiftType),
        }).convertList(list),
    },
    [PlatformFormat.FIGMA_SCRIPT]: {
        themes: true,
        write: (list) => new FigmaScriptTokenConverter().convertList(list),
    },
    [PlatformFormat.ANDROID]: {
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

export function toDocumentFormat(format?: string, fallback = TokenFormat.DTCG): TokenFormat {
    const resolved = format ?? fallback;
    if (tokenFormats.formats().includes(resolved as TokenFormat)) {
        return resolved as TokenFormat;
    }

    throw new Error(`Unknown format "${resolved}". Available: ${tokenFormats.formats().join(", ")}`);
}

function toOutputFormat(format?: string, fallback = PlatformFormat.CSS): OutputFormat {
    const resolved = format === TAILWIND_ALIAS ? PlatformFormat.TAILWIND_V4 : format ?? fallback;
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
