import { TokenGroup } from "#/core/model/TokenGroup";
import { TokenNode } from "#/core/model/TokenNode";
import { TokenReference } from "#/core/model/TokenReference";
import { BorderValue } from "#/core/model/values/BorderValue";
import { GradientStop } from "#/core/model/values/GradientValue";
import { ShadowLayer } from "#/core/model/values/ShadowValue";
import { StrokeStyleObject } from "#/core/model/values/StrokeStyleValue";
import { TransitionValue } from "#/core/model/values/TransitionValue";
import { TypographyValue } from "#/core/model/values/TypographyValue";
import type { IssueSeverity, ValidationIssue } from "#/core/validation/TokenValidator";

/**
 * The root of a DTCG token document, corresponding to a single `.json` file.
 *
 * @see https://tr.designtokens.org/format/#file-format
 */
export class Dtcg {
    readonly #root: TokenGroup;

    /**
     * The origin of this token document.
     *
     * Can be a file path ({@code "tokens.json"}), a URL, or
     * {@code "-"} for stdin.
     * Used in validation diagnostics as the {@code sourcePath}.
     */
    readonly source?: string;

    constructor(root: TokenGroup, source?: string) {
        this.#root = root;
        this.source = source;
    }

    /**
     * Returns the top-level child token or group with the given name,
     * or undefined.
     */
    get(name: string): TokenGroup | TokenNode<unknown> | undefined {
        return this.#root.get(name);
    }

    /**
     * Returns all top-level child names in insertion order.
     */
    keys(): IterableIterator<string> {
        return this.#root.keys();
    }

    /** Returns all top-level child entries as [name, node] pairs in insertion order. */
    entries(): IterableIterator<[string, TokenGroup | TokenNode<unknown>]> {
        return this.#root.entries();
    }

    get size(): number {
        return this.#root.size;
    }

    /**
     * Validates the document and returns all found issues.
     *
     * @param base - Optional base document to use as fallback when resolving references.
     *   Pass the base document when validating a theme file, so that references to tokens
     *   defined in the base are resolved correctly.
     */
    validate(base?: Dtcg): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const seen = new Set<string>();
        this.#validateGroup(this.#root, [], issues, seen, base);
        for (const issue of issues) {
            issue.name = "internal";
            if (this.source !== undefined) {
                issue.sourcePath = this.source;
            }
        }
        return issues;
    }

    #push(issues: ValidationIssue[], seen: Set<string>, severity: IssueSeverity, tokenPath: string, message: string): void {
        const key = `${severity}:${tokenPath}:${message}`;
        if (seen.has(key)) return;
        seen.add(key);
        issues.push({ tokenPath, severity, message: message.includes(tokenPath) ? message : `${tokenPath}: ${message}` });
    }

    #validateGroup(group: TokenGroup, path: string[], issues: ValidationIssue[], seen: Set<string>, base?: Dtcg): void {
        const groupPath = path.join(".") || "<root>";

        if (group.extends instanceof TokenReference) {
            this.#checkRef(group.extends, groupPath, issues, seen, new Set([groupPath]), base);
        }

        for (const [key, child] of group.entries()) {
            const childPath = [...path, key];
            if (child instanceof TokenGroup) {
                this.#validateGroup(child, childPath, issues, seen, base);
            } else {
                this.#validateToken(child, childPath, issues, seen, base);
            }
        }
    }

    #validateToken(token: TokenNode<unknown>, path: string[], issues: ValidationIssue[], seen: Set<string>, base?: Dtcg): void {
        const tokenPath = path.join(".");
        const visiting = new Set<string>([tokenPath]);
        const value = token.value;

        if (value instanceof TokenReference) {
            this.#checkRef(value, tokenPath, issues, seen, visiting, base);
            if (token.type !== undefined) {
                const resolved = this.#resolveChain(value, undefined, base);
                if (resolved instanceof TokenNode && resolved.type !== undefined && resolved.type !== token.type) {
                    this.#push(issues, seen, "error", tokenPath, `type mismatch: token is "${token.type}" but references "${resolved.type}" token {${value.value}}`);
                }
            }
            return;
        }

        if (value instanceof BorderValue) {
            this.#checkRefField(value.color, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.width, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.style, tokenPath, issues, seen, visiting, base);
            if (value.style instanceof StrokeStyleObject) {
                for (const d of value.style.dashArray) {
                    this.#checkRefField(d, tokenPath, issues, seen, visiting, base);
                }
            }
            return;
        }

        if (value instanceof TransitionValue) {
            this.#checkRefField(value.duration, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.delay, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.timingFunction, tokenPath, issues, seen, visiting, base);
            return;
        }

        if (value instanceof ShadowLayer) {
            this.#validateShadowLayer(value, tokenPath, issues, seen, visiting, base);
            return;
        }

        if (Array.isArray(value)) {
            const positions: number[] = [];
            for (const item of value) {
                if (item instanceof TokenReference) {
                    this.#checkRef(item, tokenPath, issues, seen, visiting, base);
                } else if (item instanceof ShadowLayer) {
                    this.#validateShadowLayer(item, tokenPath, issues, seen, visiting, base);
                } else if (item instanceof GradientStop) {
                    this.#checkRefField(item.color, tokenPath, issues, seen, visiting, base);
                    this.#checkRefField(item.position, tokenPath, issues, seen, visiting, base);
                    if (typeof item.position === "number") {
                        if (positions.includes(item.position)) {
                            this.#push(issues, seen, "error", tokenPath, `gradient has duplicate stop position ${item.position}`);
                        } else {
                            positions.push(item.position);
                        }
                    }
                }
            }
            return;
        }

        if (value instanceof TypographyValue) {
            this.#checkRefField(value.fontFamily, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.fontSize, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.fontWeight, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.letterSpacing, tokenPath, issues, seen, visiting, base);
            this.#checkRefField(value.lineHeight, tokenPath, issues, seen, visiting, base);
            if (Array.isArray(value.fontFamily)) {
                for (const f of value.fontFamily) {
                    if (f instanceof TokenReference) this.#checkRef(f, tokenPath, issues, seen, visiting, base);
                }
            }
        }
    }

    #validateShadowLayer(layer: ShadowLayer, tokenPath: string, issues: ValidationIssue[], seen: Set<string>, visiting: Set<string>, base?: Dtcg): void {
        this.#checkRefField(layer.color, tokenPath, issues, seen, visiting, base);
        this.#checkRefField(layer.offsetX, tokenPath, issues, seen, visiting, base);
        this.#checkRefField(layer.offsetY, tokenPath, issues, seen, visiting, base);
        this.#checkRefField(layer.blur, tokenPath, issues, seen, visiting, base);
        this.#checkRefField(layer.spread, tokenPath, issues, seen, visiting, base);
    }

    #checkRefField(value: unknown, tokenPath: string, issues: ValidationIssue[], seen: Set<string>, visiting: Set<string>, base?: Dtcg): void {
        if (value instanceof TokenReference) {
            this.#checkRef(value, tokenPath, issues, seen, visiting, base);
        }
    }

    #checkRef(ref: TokenReference, tokenPath: string, issues: ValidationIssue[], seen: Set<string>, visiting: Set<string>, base?: Dtcg): void {
        const target = this.#resolveRef(ref, base);
        if (!target) {
            this.#push(issues, seen, "error", tokenPath, `references {${ref.value}} which does not exist`);
            return;
        }

        if (target instanceof TokenGroup) {
            this.#push(issues, seen, "error", tokenPath, `references {${ref.value}} which is a group, not a token`);
            return;
        }

        if (visiting.has(ref.value)) {
            this.#push(issues, seen, "error", tokenPath, `circular reference: {${ref.value}}`);
            return;
        }

        if (target.value instanceof TokenReference) {
            visiting.add(ref.value);
            this.#checkRef(target.value, ref.value, issues, seen, visiting, base);
            visiting.delete(ref.value);
        }

        if (target.deprecated) {
            this.#push(issues, seen, "warning", tokenPath, `references deprecated token {${ref.value}}`);
        }
    }

    #resolveRef(ref: TokenReference, base?: Dtcg): TokenGroup | TokenNode<unknown> | undefined {
        const parts = ref.value.split(".");
        let node: TokenGroup | TokenNode<unknown> | undefined = this.#root.get(parts[0]);
        if (node === undefined && base !== undefined) {
            return base.#resolveRef(ref);
        }
        for (let i = 1; i < parts.length; i++) {
            if (!(node instanceof TokenGroup)) return undefined;
            node = node.get(parts[i]);
            if (node === undefined && base !== undefined) {
                return base.#resolveRef(ref);
            }
        }
        return node;
    }

    #resolveChain(ref: TokenReference, visited = new Set<string>(), base?: Dtcg): TokenGroup | TokenNode<unknown> | undefined {
        const target = this.#resolveRef(ref, base);
        if (!(target instanceof TokenNode)) return target;
        if (target.value instanceof TokenReference) {
            if (visited.has(ref.value)) return undefined;
            visited.add(ref.value);
            return this.#resolveChain(target.value, visited, base);
        }
        return target;
    }
}
