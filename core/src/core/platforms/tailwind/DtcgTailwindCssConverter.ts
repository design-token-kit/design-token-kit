import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { DtcgListLoader } from "#/core/io/DtcgListLoader";
import type { TokenTailwindConverter } from "#/core/platforms/tailwind/TokenTailwindConverter";
import { TailwindDeclaration, TailwindTokenMapper } from "#/core/platforms/tailwind/TailwindTokenMapper";

export interface DtcgTailwindCssConverterOptions {
    /**
     * Selector that receives a plain CSS custom property mirror of the base
     * `@theme` declarations.
     *
     * Use `:host` for Shadow DOM output.
     *
     * @defaultValue `":root"`
     */
    baseSelector?: string;
    /**
     * Selector template for theme overrides. `{theme}` is replaced with the
     * resolved theme name.
     *
     * @defaultValue `"[data-theme='{theme}']"`
     */
    themeSelector?: string;
}

const DEFAULT_THEME_SELECTOR = "[data-theme='{theme}']";
const DEFAULT_BASE_SELECTOR = ":root";

/**
 * Converts token documents to Tailwind CSS v4 theme variables.
 *
 * Base tokens are emitted inside an {@code @theme} block.
 * Theme overrides are emitted as plain CSS custom properties under
 * {@code [data-theme="<name>"]}.
 */
export class DtcgTailwindCssConverter implements TokenTailwindConverter {
    readonly #loader = new DtcgListLoader();
    readonly #mapper = new TailwindTokenMapper();
    readonly #options: Required<DtcgTailwindCssConverterOptions>;

    constructor(options: DtcgTailwindCssConverterOptions = {}) {
        this.#options = {
            baseSelector: options.baseSelector ?? DEFAULT_BASE_SELECTOR,
            themeSelector: options.themeSelector ?? DEFAULT_THEME_SELECTOR,
        };
    }

    async convert(sources: string[]): Promise<string> {
        const list = await this.#loader.load(sources);
        return this.convertList(list);
    }

    convertDocument(doc: Dtcg): string {
        return this.convertList(new DtcgList(doc, new Map()));
    }

    convertList(list: DtcgList): string {
        const sections = ["@import 'tailwindcss';"];
        const baseDeclarations = this.#mapper.collectDocument(list.base);
        const baseBlock = renderBlock("@theme", baseDeclarations);
        if (baseBlock) {
            sections.push(baseBlock);
        }
        if (this.#options.baseSelector) {
            const customPropertiesBlock = renderBlock(this.#options.baseSelector, baseDeclarations);
            if (customPropertiesBlock) {
                sections.push(customPropertiesBlock);
            }
        }

        for (const [themeName, theme] of list.themes) {
            const block = renderBlock(this.#resolveThemeSelector(themeName), this.#mapper.collectDocument(theme));
            if (block) {
                sections.push(block);
            }
        }

        return sections.join("\n\n") + "\n";
    }

    #resolveThemeSelector(themeName: string): string {
        return this.#options.themeSelector.replaceAll("{theme}", themeName);
    }
}

function renderBlock(selector: string, declarations: TailwindDeclaration[]): string {
    if (declarations.length === 0) return "";
    const lines = declarations.map(({ property, value }) => `  ${property}: ${value};`).join("\n");
    return `${selector} {\n${lines}\n}`;
}
