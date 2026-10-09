import { Dtcg } from "#/core/model/Dtcg";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { AliasToken } from "#/core/model/tokens/AliasToken";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { ColorValue } from "#/core/model/values/ColorValue";
import { DimensionValue } from "#/core/model/values/DimensionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";

const SECTION_HEADERS = [
    "## Overview",
    "## Colors",
    "## Typography",
    "## Layout",
    "## Elevation & Depth",
    "## Shapes",
    "## Components",
    "## Do's and Don'ts",
];

/**
 * Serializes a {@link Dtcg} document to the DESIGN.md format.
 *
 * Output consists of a YAML frontmatter block between {@code ---} delimiters
 * followed by empty {@code ##} section headers.
 *
 * @see https://github.com/google-labs-code/design.md
 */
export class DesignMdWriter {

    write(doc: Dtcg): string {
        const lines: string[] = [];

        const root = doc.root;
        const name = this.#extensionString(root, "name");
        if (name !== undefined) {
            lines.push(`name: ${this.#quoteIfNeeded(name)}`);
        }
        const version = this.#extensionString(root, "version");
        if (version !== undefined) {
            lines.push(`version: ${version}`);
        }
        if (root.description !== undefined) {
            lines.push(`description: ${this.#quoteIfNeeded(root.description)}`);
        }

        for (const [key, child] of root.entries()) {
            if (!(child instanceof TokenGroup)) continue;
            switch (key) {
                case "colors":
                    lines.push("colors:");
                    this.#writeScalarGroup(child, lines, 1);
                    break;
                case "typography":
                    lines.push("typography:");
                    this.#writeTypographyGroup(child, lines, 1);
                    break;
                case "rounded":
                    lines.push("rounded:");
                    this.#writeScalarGroup(child, lines, 1);
                    break;
                case "spacing":
                    lines.push("spacing:");
                    this.#writeScalarGroup(child, lines, 1);
                    break;
                case "components":
                    lines.push("components:");
                    this.#writeComponentsGroup(child, lines, 1);
                    break;
                default:
                    break;
            }
        }

        const yamlBody = lines.join("\n").trimEnd();
        if (!yamlBody) {
            return this.#buildOutput("");
        }
        return this.#buildOutput(yamlBody);
    }

    #buildOutput(yamlBody: string): string {
        if (!yamlBody) {
            return `---\n---\n\n${SECTION_HEADERS.join("\n\n")}\n`;
        }
        return `---\n${yamlBody}\n---\n\n${SECTION_HEADERS.join("\n\n")}\n`;
    }

    #writeScalarGroup(
        group: TokenGroup,
        lines: string[],
        depth: number,
    ): void {
        for (const [name, token] of group.entries()) {
            if (token instanceof TokenGroup) continue;
            const serialized = this.#serializeScalarToken(token as TokenNode<unknown>);
            if (serialized === undefined) continue;
            lines.push(`${this.#indent(depth)}${name}: ${serialized}`);
        }
    }

    #writeTypographyGroup(
        group: TokenGroup,
        lines: string[],
        depth: number,
    ): void {
        for (const [name, child] of group.entries()) {
            if (child instanceof TokenGroup) {
                lines.push(`${this.#indent(depth)}${name}:`);
                this.#writeTypographyProperties(child, lines, depth + 1);
            } else {
                const typed = child as TokenNode<unknown>;
                if (typed instanceof TypographyToken && typed.value instanceof TypographyValue) {
                    lines.push(`${this.#indent(depth)}${name}:`);
                    this.#writeTypographyValue(typed.value, lines, depth + 1);
                } else if (typed.value instanceof TokenReference) {
                    lines.push(`${this.#indent(depth)}${name}: "${typed.value}"`);
                }
            }
        }
    }

    #writeTypographyProperties(
        group: TokenGroup,
        lines: string[],
        depth: number,
    ): void {
        for (const [propName, token] of group.entries()) {
            if (token instanceof TokenGroup) continue;
            const serialized = this.#serializeScalarToken(token as TokenNode<unknown>);
            if (serialized === undefined) continue;
            lines.push(`${this.#indent(depth)}${propName}: ${serialized}`);
        }
    }

    #writeComponentsGroup(
        group: TokenGroup,
        lines: string[],
        depth: number,
    ): void {
        for (const [name, child] of group.entries()) {
            if (!(child instanceof TokenGroup)) continue;
            lines.push(`${this.#indent(depth)}${name}:`);
            this.#writeComponentProperties(child, lines, depth + 1);
        }
    }

    #writeComponentProperties(
        group: TokenGroup,
        lines: string[],
        depth: number,
    ): void {
        for (const [propName, token] of group.entries()) {
            if (token instanceof TokenGroup) continue;
            const serialized = this.#serializeScalarToken(token as TokenNode<unknown>);
            if (serialized === undefined) continue;
            lines.push(`${this.#indent(depth)}${propName}: ${serialized}`);
        }
    }

    #writeTypographyValue(
        typo: TypographyValue,
        lines: string[],
        depth: number,
    ): void {
        if (typo.fontFamily !== undefined) {
            const ff = this.#serializeFontFamilyOrRef(typo.fontFamily);
            lines.push(`${this.#indent(depth)}fontFamily: ${ff}`);
        }
        if (typo.fontSize !== undefined) {
            const fs = this.#serializeDimensionOrRef(typo.fontSize);
            lines.push(`${this.#indent(depth)}fontSize: ${fs}`);
        }
        if (typo.fontWeight !== undefined) {
            const fw = this.#serializeFontWeightOrRef(typo.fontWeight);
            lines.push(`${this.#indent(depth)}fontWeight: ${fw}`);
        }
        if (typo.letterSpacing !== undefined) {
            const ls = this.#serializeDimensionOrRef(typo.letterSpacing);
            lines.push(`${this.#indent(depth)}letterSpacing: ${ls}`);
        }
        if (typo.lineHeight !== undefined) {
            const lh = this.#serializeNumberOrRef(typo.lineHeight);
            lines.push(`${this.#indent(depth)}lineHeight: ${lh}`);
        }
    }

    #serializeScalarToken(token: TokenNode<unknown>): string | undefined {
        const value = token.value;
        if (value instanceof TokenReference) return `"${value}"`;

        if (token instanceof ColorToken) {
            return this.#serializeColor(value as ColorValue);
        }
        if (token instanceof DimensionToken) {
            return this.#serializeDimension(value as DimensionValue);
        }
        if (token instanceof NumberToken) {
            return String(value);
        }
        if (token instanceof FontFamilyToken) {
            return this.#serializeFontFamilyOrRef(value);
        }
        if (token instanceof FontWeightToken) {
            return String(value);
        }
        if (token instanceof TypographyToken) {
            return undefined;
        }
        if (token instanceof AliasToken) {
            return value instanceof TokenReference ? `"${value}"` : undefined;
        }
        return undefined;
    }

    #serializeColor(color: ColorValue): string {
        if (color.alpha === 0) {
            return "transparent";
        }
        if (color.hex) {
            if (color.alpha === 1) return `"${color.hex}"`;
            const alphaHex = Math.round(color.alpha * 255).toString(16).padStart(2, "0");
            return `"${color.hex}${alphaHex}"`;
        }
        switch (color.colorSpace) {
            case "srgb":
            case "srgb-linear":
            case "display-p3":
            case "a98-rgb":
            case "prophoto-rgb":
            case "rec2020": {
                const [r, g, b] = color.components;
                const ri = this.#componentToInt(r);
                const gi = this.#componentToInt(g);
                const bi = this.#componentToInt(b);
                if (color.alpha === 1) {
                    return `"${this.#rgbToHex(ri, gi, bi)}"`;
                }
                return `"${this.#rgbToHex(ri, gi, bi)}${Math.round(color.alpha * 255).toString(16).padStart(2, "0")}"`;
            }
            case "hsl":
            case "hwb":
            case "lab":
            case "lch":
            case "oklab":
            case "oklch":
            case "xyz-d65":
            case "xyz-d50":
                return `"${this.#colorFn(color)}"`;
        }
    }

    #colorFn(color: ColorValue): string {
        const comps = color.components.map((c) =>
            typeof c === "number" ? c : "none",
        );
        const fnName = color.colorSpace.replace("-", "");
        const args = comps.join(" ");
        if (color.alpha < 1) {
            return `${fnName}(${args} / ${color.alpha})`;
        }
        return `${fnName}(${args})`;
    }

    #serializeDimension(dim: DimensionValue): string {
        return `${dim.value}${dim.unit}`;
    }

    #serializeFontFamilyOrRef(value: unknown): string {
        if (value instanceof TokenReference) return `"${value}"`;
        if (typeof value === "string") return value;
        if (Array.isArray(value)) {
            const items = value.map((v) =>
                v instanceof TokenReference ? `"${v}"`
                : typeof v === "string" && v.includes(" ") ? `"${v}"`
                : String(v),
            );
            return `[${items.join(", ")}]`;
        }
        return String(value);
    }

    #serializeDimensionOrRef(value: DimensionValue | TokenReference): string {
        if (value instanceof TokenReference) return `"${value}"`;
        return this.#serializeDimension(value);
    }

    #serializeFontWeightOrRef(value: unknown): string {
        if (value instanceof TokenReference) return `"${value}"`;
        return String(value);
    }

    #serializeNumberOrRef(value: number | TokenReference): string {
        if (value instanceof TokenReference) return `"${value}"`;
        return String(value);
    }

    #extensionString(root: TokenGroup, key: string): string | undefined {
        const value = root.extensions?.[key];
        if (typeof value === "string") return value;
        return undefined;
    }

    #quoteIfNeeded(value: string): string {
        if (/["':{}\[\],&\*\?!|>#@]/.test(value) || value.startsWith("-") || value.startsWith(" ") || value.endsWith(" ")) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }

    #componentToInt(c: number | "none"): number {
        if (c === "none") return 0;
        return Math.round(c * 255);
    }

    #rgbToHex(r: number, g: number, b: number): string {
        const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    #indent(depth: number): string {
        return "  ".repeat(depth);
    }
}
