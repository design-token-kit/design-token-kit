/**
 * A pre-defined font weight name and the numeric weight it stands for.
 *
 * The names and their weights come from the DTCG font weight table.
 * Names are case-sensitive.
 * Readers create an instance from a name with {@link FontWeightName.fromName}.
 * Writers serialize it back with {@link FontWeightName.name}.
 *
 * @see https://www.designtokens.org/tr/2025.10/format/#font-weight
 */
export class FontWeightName {

    static readonly THIN = new FontWeightName("thin", 100);
    static readonly HAIRLINE = new FontWeightName("hairline", 100);
    static readonly EXTRA_LIGHT = new FontWeightName("extra-light", 200);
    static readonly ULTRA_LIGHT = new FontWeightName("ultra-light", 200);
    static readonly LIGHT = new FontWeightName("light", 300);
    static readonly NORMAL = new FontWeightName("normal", 400);
    static readonly REGULAR = new FontWeightName("regular", 400);
    static readonly BOOK = new FontWeightName("book", 400);
    static readonly MEDIUM = new FontWeightName("medium", 500);
    static readonly SEMI_BOLD = new FontWeightName("semi-bold", 600);
    static readonly DEMI_BOLD = new FontWeightName("demi-bold", 600);
    static readonly BOLD = new FontWeightName("bold", 700);
    static readonly EXTRA_BOLD = new FontWeightName("extra-bold", 800);
    static readonly ULTRA_BOLD = new FontWeightName("ultra-bold", 800);
    static readonly BLACK = new FontWeightName("black", 900);
    static readonly HEAVY = new FontWeightName("heavy", 900);
    static readonly EXTRA_BLACK = new FontWeightName("extra-black", 950);
    static readonly ULTRA_BLACK = new FontWeightName("ultra-black", 950);

    private static readonly VALUES: readonly FontWeightName[] = [
        FontWeightName.THIN,
        FontWeightName.HAIRLINE,
        FontWeightName.EXTRA_LIGHT,
        FontWeightName.ULTRA_LIGHT,
        FontWeightName.LIGHT,
        FontWeightName.NORMAL,
        FontWeightName.REGULAR,
        FontWeightName.BOOK,
        FontWeightName.MEDIUM,
        FontWeightName.SEMI_BOLD,
        FontWeightName.DEMI_BOLD,
        FontWeightName.BOLD,
        FontWeightName.EXTRA_BOLD,
        FontWeightName.ULTRA_BOLD,
        FontWeightName.BLACK,
        FontWeightName.HEAVY,
        FontWeightName.EXTRA_BLACK,
        FontWeightName.ULTRA_BLACK,
    ];

    /**
     * Creates one of the fixed font weight names declared above.
     *
     * @param name - The DTCG name, as written in a token file.
     * @param weight - The numeric weight the name stands for, from 1 to 1000.
     */
    private constructor(readonly name: string, readonly weight: number) {}

    /**
     * Finds the font weight with the given DTCG name.
     *
     * @param name - A DTCG font weight name, matched case-sensitively.
     * @throws Error when the name is not a DTCG font weight name.
     */
    static fromName(name: string): FontWeightName {
        const found: FontWeightName | undefined = FontWeightName.find(name);
        if (found === undefined) {
            throw new Error(`unknown font weight name '${name}'; expected ${FontWeightName.names().join(", ")}`);
        }
        return found;
    }

    /**
     * Looks up the font weight with the given DTCG name, if there is one.
     *
     * For a reader that reports an unknown name in its own diagnostic.
     *
     * @param name - A DTCG font weight name, matched case-sensitively.
     * @returns The font weight, or `undefined` for an unknown name.
     */
    static find(name: string): FontWeightName | undefined {
        return FontWeightName.VALUES.find((value) => value.name === name);
    }

    /**
     * Lists every DTCG font weight name in the order of the DTCG table.
     */
    static names(): string[] {
        return FontWeightName.VALUES.map((value) => value.name);
    }

}
