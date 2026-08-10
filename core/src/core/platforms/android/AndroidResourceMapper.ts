import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import type { TokenType } from "#/core/model/TokenType";
import { BorderValue } from "#/core/model/values/BorderValue";
import { ColorValue } from "#/core/model/values/ColorValue";
import { CubicBezierValue } from "#/core/model/values/CubicBezierValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { DurationValue } from "#/core/model/values/DurationValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import type { AndroidResource } from "#/core/platforms/android/AndroidResource";
import { AndroidColorValueConverter } from "#/core/platforms/android/AndroidColorValueConverter";
import {
    AndroidDimensionValueConverter,
    type AndroidDimensionUnit,
} from "#/core/platforms/android/AndroidDimensionValueConverter";
import { AndroidResourceNamer } from "#/core/platforms/android/AndroidResourceNamer";
import { AndroidResourceType } from "#/core/platforms/android/AndroidResourceType";
import { AndroidUnitResolver } from "#/core/platforms/android/AndroidUnitResolver";

/**
 * Group name for tokens declared directly at the document root.
 */
const ROOT_GROUP = "tokens";

/**
 * Nesting depth of the groups resources are sectioned by inside a file. The
 * first level names the file, the second one names the section within it.
 */
const SECTION_DEPTH = 2;

/**
 * Suffixes appended to a composite token name for each decomposed field.
 */
const FIELD_SUFFIX = {
    fontSize: "font_size",
    letterSpacing: "letter_spacing",
    lineHeight: "line_height",
    fontWeight: "font_weight",
    fontFamily: "font_family",
    color: "color",
    width: "width",
    offsetX: "offset_x",
    offsetY: "offset_y",
    blur: "blur",
    spread: "spread",
    duration: "duration",
    delay: "delay",
    position: "position",
} as const;

/**
 * Maps a DTCG document to a flat list of Android resources.
 *
 * @remarks
 * Android resources are scalar, so composite tokens (typography, shadow,
 * border, transition, gradient) are decomposed into one resource per field,
 * named after the composite with a field suffix. Token references become
 * native `@color/...` and `@dimen/...` resource references.
 *
 * Token types without an Android resource counterpart (cubicBezier, stroke
 * style geometry) are skipped rather than approximated.
 */
export class AndroidResourceMapper {
    readonly #colorConverter = new AndroidColorValueConverter();
    readonly #dimensionConverter: AndroidDimensionValueConverter;
    readonly #unitResolver = new AndroidUnitResolver();
    readonly #namer = new AndroidResourceNamer();

    constructor(dimensionConverter: AndroidDimensionValueConverter) {
        this.#dimensionConverter = dimensionConverter;
    }

    #doc: Dtcg | undefined;
    #base: Dtcg | undefined;
    #section: { path: string; description: string | undefined } | undefined;

    /**
     * Maps every token of a document to Android resources.
     *
     * @param doc - Parsed DTCG document.
     * @param base - Base document used to resolve references of a theme
     *   document, whose own tree holds overrides only.
     * @returns Resources in document order.
     */
    map(doc: Dtcg, base?: Dtcg): AndroidResource[] {
        this.#doc = doc;
        this.#base = base;
        this.#section = undefined;
        return this.#mapGroup(doc.root, [], 0);
    }

    #mapGroup(group: TokenGroup, path: readonly string[], depth: number): AndroidResource[] {
        const resources: AndroidResource[] = [];
        for (const [key, child] of group.entries()) {
            const childPath = [...path, ...this.#namer.parts(key)];
            if (child instanceof TokenGroup) {
                resources.push(...this.#mapChildGroup(child, childPath, depth + 1));
            } else if (child instanceof TokenNode) {
                resources.push(...this.#mapToken(child, childPath));
            }
        }
        return resources;
    }

    /**
     * Maps a nested group, opening a new section when the group sits at the
     * section depth. Resources of deeper groups stay in the section their
     * ancestor opened.
     */
    #mapChildGroup(group: TokenGroup, path: readonly string[], depth: number): AndroidResource[] {
        if (depth !== SECTION_DEPTH) return this.#mapGroup(group, path, depth);

        this.#section = { path: path.join("."), description: group.description };
        const resources = this.#mapGroup(group, path, depth);
        this.#section = undefined;
        return resources;
    }

    #mapToken(node: TokenNode<unknown>, path: readonly string[]): AndroidResource[] {
        const resources = this.#mapValue(node.value, node.type, path);
        if (resources.length === 0 || !node.description) return resources;
        return [{ ...resources[0], description: node.description }, ...resources.slice(1)];
    }

    #mapValue(value: unknown, type: TokenType | undefined, path: readonly string[]): AndroidResource[] {
        if (type === "fontFamily") return this.#mapFontFamily(value, path);
        if (value instanceof TokenReference) return this.#mapAlias(value, type, path);
        const scalar = this.#mapScalar(value, type, path);
        if (scalar) return [scalar];
        return this.#mapComposite(value, path);
    }

    /**
     * Maps an alias token. An alias to a composite has no single resource to
     * point at, because the composite itself is decomposed, so it is
     * decomposed as well, with every field referencing the matching field of
     * the target.
     */
    #mapAlias(value: TokenReference, type: TokenType | undefined, path: readonly string[]): AndroidResource[] {
        const target = this.#resolveValue(value);
        if (this.#isComposite(target)) {
            return this.#mapComposite(target, path)
                .map((resource) => this.#toFieldReference(resource, path, value));
        }
        return [this.#mapReference(value, type, path)];
    }

    /**
     * Whether a value is decomposed into several resources. A font family list
     * is not: it collapses into the single family Android names.
     */
    #isComposite(value: unknown): boolean {
        return value instanceof TypographyValue
            || value instanceof ShadowLayer
            || value instanceof BorderValue
            || value instanceof TransitionValue
            || (Array.isArray(value) && !this.#isFontFamilyList(value));
    }

    #isFontFamilyList(value: unknown[]): boolean {
        return value.every((entry) => typeof entry === "string");
    }

    /**
     * Rewrites a decomposed field of an aliased composite into a reference to
     * the matching field of the alias target.
     */
    #toFieldReference(
        resource: AndroidResource,
        path: readonly string[],
        value: TokenReference,
    ): AndroidResource {
        const suffix = resource.name.slice(this.#namer.name(path).length);
        const targetName = `${this.#namer.name(value.path.segments())}${suffix}`;
        const referenceType = resource.type === AndroidResourceType.FLOAT
            ? AndroidResourceType.DIMEN
            : resource.type;
        return { ...resource, value: `@${referenceType}/${targetName}` };
    }

    /**
     * Maps a font family token. A DTCG font family may list fallbacks, while
     * an Android resource names a single family, so the first concrete family
     * wins.
     */
    #mapFontFamily(value: unknown, path: readonly string[]): AndroidResource[] {
        if (value instanceof TokenReference) {
            return [this.#reference(AndroidResourceType.STRING, path, value)];
        }
        const family = this.#firstFamily(value);
        if (family === undefined) return [];
        return [this.#resource(AndroidResourceType.STRING, path, family)];
    }

    #firstFamily(value: unknown): string | undefined {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) {
            return value.find((entry) => typeof entry === "string") as string | undefined;
        }
        return undefined;
    }

    #mapScalar(value: unknown, type: TokenType | undefined, path: readonly string[]): AndroidResource | undefined {
        if (value instanceof TokenReference) return this.#mapReference(value, type, path);
        if (value === undefined) return undefined;
        if (value instanceof ColorValue) {
            return this.#resource(AndroidResourceType.COLOR, path, this.#colorConverter.convert(value));
        }
        if (value instanceof DimensionValue) {
            return this.#dimension(value, path, this.#unitResolver.resolve(path));
        }
        if (value instanceof DurationValue) {
            return this.#resource(AndroidResourceType.INTEGER, path, String(Math.round(value.toMs())));
        }
        if (typeof value === "number") return this.#number(value, path);
        if (typeof value === "string") {
            return this.#resource(AndroidResourceType.STRING, path, value);
        }
        return undefined;
    }

    /**
     * Maps a unitless number. Whole numbers become integer resources, while
     * fractional ones become float resources, because Android integers cannot
     * carry a fraction.
     */
    #number(value: number, path: readonly string[]): AndroidResource {
        return this.#resource(this.#numberType(value), path, String(value));
    }

    #mapComposite(value: unknown, path: readonly string[]): AndroidResource[] {
        if (value instanceof TypographyValue) return this.#mapTypography(value, path);
        if (value instanceof ShadowLayer) return this.#mapShadowLayer(value, path);
        if (value instanceof BorderValue) return this.#mapBorder(value, path);
        if (value instanceof TransitionValue) return this.#mapTransition(value, path);
        if (Array.isArray(value)) return this.#mapArray(value, path);
        return [];
    }

    #mapTypography(value: TypographyValue, path: readonly string[]): AndroidResource[] {
        const resources: AndroidResource[] = [];
        resources.push(...this.#dimensionField(value.fontSize, path, FIELD_SUFFIX.fontSize, "sp"));
        resources.push(...this.#dimensionField(value.letterSpacing, path, FIELD_SUFFIX.letterSpacing, "sp"));
        resources.push(...this.#numberField(value.lineHeight, path, FIELD_SUFFIX.lineHeight));
        resources.push(...this.#fontWeightField(value.fontWeight, path));
        resources.push(...this.#fontFamilyField(value.fontFamily, path));
        return resources;
    }

    #mapShadowLayer(value: ShadowLayer, path: readonly string[]): AndroidResource[] {
        return [
            ...this.#colorField(value.color, path, FIELD_SUFFIX.color),
            ...this.#dimensionField(value.offsetX, path, FIELD_SUFFIX.offsetX, "dp"),
            ...this.#dimensionField(value.offsetY, path, FIELD_SUFFIX.offsetY, "dp"),
            ...this.#dimensionField(value.blur, path, FIELD_SUFFIX.blur, "dp"),
            ...this.#dimensionField(value.spread, path, FIELD_SUFFIX.spread, "dp"),
        ];
    }

    #mapBorder(value: BorderValue, path: readonly string[]): AndroidResource[] {
        return [
            ...this.#colorField(value.color, path, FIELD_SUFFIX.color),
            ...this.#dimensionField(value.width, path, FIELD_SUFFIX.width, "dp"),
        ];
    }

    #mapTransition(value: TransitionValue, path: readonly string[]): AndroidResource[] {
        return [
            ...this.#durationField(value.duration, path, FIELD_SUFFIX.duration),
            ...this.#durationField(value.delay, path, FIELD_SUFFIX.delay),
        ];
    }

    /**
     * Maps an array value. A list of plain strings is a font family fallback
     * list, which collapses into a single resource; any other list is indexed,
     * one resource group per item.
     */
    #mapArray(value: unknown[], path: readonly string[]): AndroidResource[] {
        if (this.#isFontFamilyList(value)) return this.#mapFontFamily(value, path);
        return value.flatMap((item, index) => this.#mapArrayItem(item, [...path, String(index)]));
    }

    #mapArrayItem(item: unknown, path: readonly string[]): AndroidResource[] {
        if (item instanceof GradientStop) {
            return [
                ...this.#colorField(item.color, path, FIELD_SUFFIX.color),
                ...this.#numberField(item.position, path, FIELD_SUFFIX.position),
            ];
        }
        if (item instanceof ShadowLayer) return this.#mapShadowLayer(item, path);
        if (item instanceof StrokeStyleObject || item instanceof CubicBezierValue) return [];
        return this.#mapValue(item, undefined, path);
    }

    #dimensionField(
        value: DimensionValue | TokenReference | undefined,
        path: readonly string[],
        suffix: string,
        unit: AndroidDimensionUnit,
    ): AndroidResource[] {
        const fieldPath = [...path, suffix];
        if (value instanceof TokenReference) {
            return [this.#reference(AndroidResourceType.DIMEN, fieldPath, value)];
        }
        if (value instanceof DimensionValue) {
            return [this.#dimension(value, fieldPath, unit)];
        }
        return [];
    }

    #colorField(
        value: ColorValue | TokenReference | undefined,
        path: readonly string[],
        suffix: string,
    ): AndroidResource[] {
        const fieldPath = [...path, suffix];
        if (value instanceof TokenReference) {
            return [this.#reference(AndroidResourceType.COLOR, fieldPath, value)];
        }
        if (value instanceof ColorValue) {
            return [this.#resource(AndroidResourceType.COLOR, fieldPath, this.#colorConverter.convert(value))];
        }
        return [];
    }

    #durationField(
        value: DurationValue | TokenReference | undefined,
        path: readonly string[],
        suffix: string,
    ): AndroidResource[] {
        const fieldPath = [...path, suffix];
        if (value instanceof TokenReference) {
            return [this.#reference(AndroidResourceType.INTEGER, fieldPath, value)];
        }
        if (value instanceof DurationValue) {
            return [this.#resource(AndroidResourceType.INTEGER, fieldPath, String(Math.round(value.toMs())))];
        }
        return [];
    }

    #numberField(value: unknown, path: readonly string[], suffix: string): AndroidResource[] {
        const fieldPath = [...path, suffix];
        if (value instanceof TokenReference) {
            return [this.#reference(this.#numberType(this.#resolveValue(value)), fieldPath, value)];
        }
        if (typeof value === "number") {
            return [this.#number(value, fieldPath)];
        }
        return [];
    }

    #fontWeightField(value: unknown, path: readonly string[]): AndroidResource[] {
        const fieldPath = [...path, FIELD_SUFFIX.fontWeight];
        if (value instanceof TokenReference) {
            return [this.#reference(AndroidResourceType.INTEGER, fieldPath, value)];
        }
        if (typeof value === "number") {
            return [this.#resource(AndroidResourceType.INTEGER, fieldPath, String(value))];
        }
        if (typeof value === "string") {
            return [this.#resource(AndroidResourceType.STRING, fieldPath, value)];
        }
        return [];
    }

    #fontFamilyField(value: unknown, path: readonly string[]): AndroidResource[] {
        return this.#mapFontFamily(value, [...path, FIELD_SUFFIX.fontFamily]);
    }

    #mapReference(
        value: TokenReference,
        type: TokenType | undefined,
        path: readonly string[],
    ): AndroidResource {
        return this.#reference(this.#referenceType(type, value), path, value);
    }

    /**
     * Resolves a reference to the value at the end of its alias chain, so an
     * alias can be typed after what it actually points at.
     */
    #resolveValue(value: TokenReference): unknown {
        const target = this.#doc?.resolveChain(value, this.#base);
        return target instanceof TokenNode ? target.value : undefined;
    }

    /**
     * Resource type of an alias token. A `number` alias is typed after the
     * value it resolves to, because whole and fractional numbers use different
     * resource types. An alias without a declared type is typed after its
     * target as well, so that a reference always names the resource type the
     * target is emitted as.
     */
    #referenceType(type: TokenType | undefined, value: TokenReference): AndroidResourceType {
        if (type === undefined || type === "number") {
            return this.#valueType(this.#resolveValue(value));
        }
        const types: Partial<Record<TokenType, AndroidResourceType>> = {
            color: AndroidResourceType.COLOR,
            dimension: AndroidResourceType.DIMEN,
            duration: AndroidResourceType.INTEGER,
            fontFamily: AndroidResourceType.STRING,
            fontWeight: AndroidResourceType.INTEGER,
        };
        return types[type] ?? this.#valueType(this.#resolveValue(value));
    }

    /**
     * Resource type carrying a resolved token value.
     */
    #valueType(value: unknown): AndroidResourceType {
        if (value instanceof ColorValue) return AndroidResourceType.COLOR;
        if (value instanceof DimensionValue) return AndroidResourceType.DIMEN;
        if (value instanceof DurationValue) return AndroidResourceType.INTEGER;
        if (typeof value === "number") return this.#numberType(value);
        if (typeof value === "string" || Array.isArray(value)) return AndroidResourceType.STRING;
        return AndroidResourceType.COLOR;
    }

    /**
     * Resource type carrying a number: whole numbers fit an integer resource,
     * fractional ones need a float resource.
     */
    #numberType(value: unknown): AndroidResourceType {
        const whole = typeof value === "number" ? Number.isInteger(value) : false;
        return whole ? AndroidResourceType.INTEGER : AndroidResourceType.FLOAT;
    }

    #dimension(value: DimensionValue, path: readonly string[], unit: AndroidDimensionUnit): AndroidResource {
        return this.#resource(AndroidResourceType.DIMEN, path, this.#dimensionConverter.convert(value, unit));
    }

    /**
     * Builds a resource holding a native reference. Float resources are
     * declared with the `dimen` type, so references to them use that type.
     */
    #reference(type: AndroidResourceType, path: readonly string[], value: TokenReference): AndroidResource {
        const referenceType = type === AndroidResourceType.FLOAT ? AndroidResourceType.DIMEN : type;
        return this.#resource(type, path, `@${referenceType}/${this.#namer.name(value.path.segments())}`);
    }

    #resource(type: AndroidResourceType, path: readonly string[], value: string): AndroidResource {
        return {
            type,
            name: this.#namer.name(path),
            group: this.#group(path),
            section: this.#section?.path ?? "",
            sectionDescription: this.#section?.description,
            value,
        };
    }

    /**
     * Root token group of a resource. Tokens declared at the document root
     * have no group of their own and are collected under a shared name.
     */
    #group(path: readonly string[]): string {
        return path.length > 1 ? path[0] : ROOT_GROUP;
    }
}
