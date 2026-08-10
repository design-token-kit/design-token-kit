import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import type { AndroidResource } from "#/core/platforms/android/AndroidResource";
import { AndroidDimensionValueConverter } from "#/core/platforms/android/AndroidDimensionValueConverter";
import { AndroidResourceMapper } from "#/core/platforms/android/AndroidResourceMapper";
import {
    createResourceLayout,
    type AndroidResourceLayout,
    type AndroidResourceLayoutName,
} from "#/core/platforms/android/AndroidResourceLayout";
import { AndroidResourceRenderer } from "#/core/platforms/android/AndroidResourceRenderer";
import type { TokenAndroidOutput } from "#/core/platforms/android/TokenAndroidOutput";
import type { TokenConverter } from "#/core/platforms/TokenConverter";

/**
 * Theme name Android renders into the `values-night` resource directory.
 */
const NIGHT_THEME = "dark";

const BASE_THEME = "base";

const BASE_DIRECTORY = "values";

const NIGHT_DIRECTORY = "values-night";

/**
 * Options controlling Android resource generation.
 */
export interface AndroidTokenConverterOptions {
    /**
     * Pixel base used to resolve `rem` dimensions, which Android does not
     * support.
     *
     * @defaultValue `16`
     */
    remBase?: number;

    /**
     * How resources are distributed across resource files: one file per root
     * token group, or one file per Android resource type.
     *
     * @defaultValue `"layer"`
     */
    layout?: AndroidResourceLayoutName;
}

/**
 * Converts DTCG token documents to Android resource XML.
 *
 * @remarks
 * Tokens are flattened to `snake_case` resource names and split across files
 * by root token group, so that `primitive.xml`, `semantic.xml` and
 * `component.xml` mirror the token hierarchy. The `type` layout splits by
 * Android resource type instead, following the conventional `colors.xml` /
 * `dimens.xml` naming. Composite tokens are decomposed into one resource per
 * field, because Android resources are scalar.
 *
 * Themes are emitted as separate resource directories holding only the
 * overridden tokens, relying on the Android resource qualifier mechanism to
 * fall back to the base values. The `dark` theme maps to `values-night`, any
 * other theme to `values-<theme>`.
 */
export class AndroidTokenConverter implements TokenConverter {
    readonly #mapper: AndroidResourceMapper;
    readonly #layout: AndroidResourceLayout;
    readonly #renderer = new AndroidResourceRenderer();

    constructor(options: AndroidTokenConverterOptions = {}) {
        this.#mapper = new AndroidResourceMapper(new AndroidDimensionValueConverter(options.remBase));
        this.#layout = createResourceLayout(options.layout ?? "layer");
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    /**
     * Converts a document without themes into a single resource file.
     *
     * @throws When the list carries themes, which produce multiple files.
     */
    convertList(list: DtcgList): string {
        if (list.themes.size > 0) {
            throw new Error("Android multi-theme output produces multiple files; use convertResourceList()");
        }

        const outputs = this.convertResourceList(list);
        if (outputs.length > 1) {
            throw new Error("Android output produces multiple resource files; use convertResourceList()");
        }
        return outputs.length === 1 ? outputs[0].content : this.#renderer.render([], this.#source(list.base));
    }

    /**
     * Converts a base document and its theme overrides into Android resource
     * files.
     *
     * @param list - Base document and named theme overrides.
     * @returns One output per resource file, in `res` directory layout.
     */
    convertResourceList(list: DtcgList): ReadonlyArray<TokenAndroidOutput> {
        const outputs: TokenAndroidOutput[] = this.#toOutputs(
            this.#mapper.map(list.base),
            BASE_THEME,
            true,
            BASE_DIRECTORY,
            this.#source(list.base),
        );

        for (const [themeName, theme] of list.themes) {
            outputs.push(...this.#toOutputs(
                this.#mapper.map(theme, list.base),
                themeName,
                false,
                this.#themeDirectory(themeName),
                this.#source(theme),
            ));
        }

        return outputs;
    }

    #toOutputs(
        resources: ReadonlyArray<AndroidResource>,
        themeName: string,
        isBase: boolean,
        directory: string,
        source: string,
    ): TokenAndroidOutput[] {
        return this.#layout.split(resources).map((file) => ({
            themeName,
            isBase,
            filePath: `${directory}/${file.fileName}`,
            content: this.#renderer.render(file.resources, source),
        }));
    }

    #themeDirectory(themeName: string): string {
        return themeName === NIGHT_THEME ? NIGHT_DIRECTORY : `${BASE_DIRECTORY}-${themeName}`;
    }

    #source(doc: Dtcg): string {
        return doc.source ?? "stdin";
    }
}
