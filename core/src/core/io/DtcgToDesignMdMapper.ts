import { Dtcg } from "#/core/model/Dtcg";
import { DtcgList } from "#/core/model/DtcgList";
import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { ColorToken } from "#/core/model/tokens/ColorToken";
import { DimensionToken } from "#/core/model/tokens/DimensionToken";
import { NumberToken } from "#/core/model/tokens/NumberToken";
import { TypographyToken } from "#/core/model/tokens/TypographyToken";
import { FontFamilyToken } from "#/core/model/tokens/FontFamilyToken";
import { FontWeightToken } from "#/core/model/tokens/FontWeightToken";
import { AliasToken } from "#/core/model/tokens/AliasToken";

type SectionName = "colors" | "typography" | "rounded" | "spacing" | "components";

const UNSUPPORTED = new Set(["border", "fontFamily", "fontWeight", "shadow", "transition", "gradient", "cubicBezier", "strokeStyle", "duration"]);

/**
 * Maps a {@link DtcgList} in DTCG tree form ({@code primitive}, {@code semantic},
 * {@code component}) to the flat DESIGN.md layout ({@code colors},
 * {@code typography}, {@code rounded}, {@code spacing}, {@code components}).
 *
 * Mapping rules:
 *
 * - {@code primitive.color.*} and {@code semantic.color.*} → {@code colors}
 * - {@code primitive.typography.*} and {@code semantic.text.*} → {@code typography}
 * - {@code primitive.dimension.*} and {@code semantic.shape.*} → {@code rounded}
 *   (name matches {@code /radius|rounded|border-width/}) or {@code spacing}
 * - {@code semantic.space.*} and {@code semantic.motion.*} → {@code spacing}
 * - {@code component.*.*} → {@code components} with dot-path flattened to dashes
 *
 * Token references are rewritten from DTCG paths ({@code primitive.color.white})
 * to DESIGN.md paths ({@code colors.white}).
 */
export class DtcgToDesignMdMapper {

    /**
     * Produces a {@link DtcgList} whose {@code base} tree uses the flat
     * DESIGN.md section keys. Themes are not mapped.
     */
    map(list: DtcgList): DtcgList {
        const collector = new TokenCollector();
        collector.walk(list.base.root, "");
        const root = collector.build(list.base.root);
        return new DtcgList(new Dtcg(root));
    }
}

class TokenCollector {
    readonly #tokens = new Map<SectionName, Map<string, TokenNode<unknown>>>();
    readonly #components = new Map<string, TokenGroup>();
    readonly #pathMap = new Map<string, string>();
    readonly #removed = new Set<string>();

    walk(group: TokenGroup, parentPath: string): void {
        for (const [name, child] of group.entries()) {
            const childPath = parentPath ? `${parentPath}.${name}` : name;

            if (child instanceof TokenGroup) {
                if (childPath.startsWith("component.")) {
                    this.#collectComponent(child, childPath);
                } else {
                    this.walk(child, childPath);
                }
            } else {
                this.#collectToken(childPath, name, child);
            }
        }
    }

    build(source: TokenGroup): TokenGroup {
        const children = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [section, tokens] of this.#tokens) {
            if (tokens.size === 0) continue;
            children.set(section, new TokenGroup({ children: this.#remapTokens(tokens, section) }));
        }
        if (this.#components.size > 0) {
            children.set("components", new TokenGroup({ children: this.#remapComponents() }));
        }
        return new TokenGroup({
            description: source.description,
            extensions: source.extensions,
            children,
        });
    }

    #remapTokens(tokens: Map<string, TokenNode<unknown>>, section: SectionName): Map<string, TokenGroup | TokenNode<unknown>> {
        const remapped = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, token] of tokens) {
            const t = this.#remapToken(token);
            if (t !== undefined) {
                remapped.set(name, t);
            } else {
                this.#removed.add(`${section}.${name}`);
            }
        }
        return remapped;
    }

    #remapComponents(): Map<string, TokenGroup | TokenNode<unknown>> {
        const remapped = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, group] of this.#components) {
            remapped.set(name, this.#remapComponent(group));
        }
        return remapped;
    }

    #remapComponent(group: TokenGroup): TokenGroup {
        const remapped = new Map<string, TokenGroup | TokenNode<unknown>>();
        for (const [name, child] of group.entries()) {
            if (child instanceof TokenGroup) {
                remapped.set(name, this.#remapComponent(child));
            } else {
                const t = this.#remapComponentProperty(child as TokenNode<unknown>);
                if (t !== undefined) {
                    remapped.set(name, t);
                }
            }
        }
        return new TokenGroup({ children: remapped });
    }

    #remapComponentProperty(token: TokenNode<unknown>): TokenNode<unknown> | undefined {
        const remapped = this.#remapToken(token);
        if (remapped === undefined) return undefined;
        const value = remapped.value;
        if (value instanceof TokenReference && this.#removed.has(value.value)) {
            return undefined;
        }
        return remapped;
    }

    #remapToken(token: TokenNode<unknown>): TokenNode<unknown> | undefined {
        const value = token.value;
        if (!(value instanceof TokenReference)) return token;
        const mapped = this.#pathMap.get(value.value);
        if (!mapped) {
            console.warn(`warning: removing reference to ${value.value} — target not mapped`);
            return undefined;
        }
        return this.#cloneWithRef(token, new TokenReference(mapped));
    }

    #cloneWithRef(token: TokenNode<unknown>, ref: TokenReference): TokenNode<unknown> {
        if (token instanceof ColorToken) return new ColorToken(ref);
        if (token instanceof DimensionToken) return new DimensionToken(ref);
        if (token instanceof TypographyToken) return new TypographyToken(ref);
        if (token instanceof NumberToken) return new NumberToken(ref as unknown as number);
        if (token instanceof FontFamilyToken) return new FontFamilyToken(ref as unknown as string);
        if (token instanceof FontWeightToken) return new FontWeightToken(ref);
        if (token instanceof AliasToken) return new AliasToken(ref);
        return token;
    }

    #collectToken(path: string, name: string, token: TokenNode<unknown>): void {
        const parts = path.split(".");
        const root = parts[0];
        if (root !== "primitive" && root !== "semantic") return;

        const typeName = parts[1];

        if (UNSUPPORTED.has(typeName)) {
            console.warn(`warning: skipping ${path} — type not supported in DESIGN.md`);
            return;
        }

        switch (typeName) {
            case "color":
                this.#add("colors", name, token);
                this.#pathMap.set(path, `colors.${name}`);
                break;
            case "typography":
                this.#add("typography", name, token);
                this.#pathMap.set(path, `typography.${name}`);
                break;
            case "dimension":
            case "number": {
                const section = this.#dimensionSection(name);
                this.#add(section, name, token);
                this.#pathMap.set(path, `${section}.${name}`);
                break;
            }
            case "text":
                this.#add("typography", name, token);
                this.#pathMap.set(path, `typography.${name}`);
                break;
            case "shape":
            case "space":
            case "motion":
            case "layer": {
                const section = this.#dimensionSection(name);
                this.#add(section, name, token);
                this.#pathMap.set(path, `${section}.${name}`);
                break;
            }
        }
    }

    #collectComponent(group: TokenGroup, path: string): void {
        const flatName = path.split(".").slice(1).join("-");
        const props = new Map<string, TokenGroup | TokenNode<unknown>>();

        for (const [name, child] of group.entries()) {
            const childPath = `${path}.${name}`;

            if (child instanceof TokenGroup) {
                this.#collectComponent(child, childPath);
            } else {
                props.set(name, child);
                this.#pathMap.set(childPath, `components.${flatName}.${name}`);
            }
        }

        if (props.size > 0) {
            this.#components.set(flatName, new TokenGroup({ children: props }));
        }
    }

    #add(section: SectionName, name: string, token: TokenNode<unknown>): void {
        if (!this.#tokens.has(section)) {
            this.#tokens.set(section, new Map());
        }
        const existing = this.#tokens.get(section)!.get(name);
        if (existing !== undefined && token.value instanceof TokenReference) {
            return;
        }
        this.#tokens.get(section)!.set(name, token);
    }

    #dimensionSection(name: string): SectionName {
        const lower = name.toLowerCase();
        if (/radius|rounded|border-width/.test(lower)) return "rounded";
        return "spacing";
    }
}
