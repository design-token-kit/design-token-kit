/**
 * A `var()` reference found in a CSS value.
 */
export interface CssVarReference {
    /** Referenced custom property, e.g. `--semantic-color-text`. */
    readonly customProperty: string;

    /**
     * Fallback text after the first top-level comma, trimmed.
     * Undefined when absent.
     */
    readonly fallback: string | undefined;
}

/**
 * Returns the `var()` references of a CSS value in source order.
 *
 * References inside a fallback belong to that fallback and are not returned
 * separately.
 */
export function findVarReferences(value: string): CssVarReference[] {
    const references: CssVarReference[] = [];
    let start: number = findVarFunction(value, 0);
    while (start !== -1) {
        const argumentsStart: number = start + VAR_FUNCTION_LENGTH;
        const argumentsEnd: number = findClosingParenthesis(value, argumentsStart);
        if (argumentsEnd === -1) break;
        references.push(toReference(value.slice(argumentsStart, argumentsEnd)));
        start = findVarFunction(value, argumentsEnd + 1);
    }
    return references;
}

/**
 * Returns the reference when the whole value is a single `var()`, otherwise
 * undefined.
 */
export function findSoleVarReference(value: string): CssVarReference | undefined {
    const trimmed: string = value.trim();
    if (findVarFunction(trimmed, 0) !== 0) return undefined;
    const argumentsEnd: number = findClosingParenthesis(trimmed, VAR_FUNCTION_LENGTH);
    if (argumentsEnd !== trimmed.length - 1) return undefined;
    return toReference(trimmed.slice(VAR_FUNCTION_LENGTH, argumentsEnd));
}

const VAR_FUNCTION_LENGTH: number = "var(".length;

function findVarFunction(value: string, from: number): number {
    const pattern: RegExp = /(?<![\w-])var\(/iy;
    let index: number = from;
    while (index < value.length) {
        const next: number = skipLiteral(value, index);
        if (next !== index) {
            index = next;
            continue;
        }
        pattern.lastIndex = index;
        if (pattern.test(value)) return index;
        index++;
    }
    return -1;
}

function findClosingParenthesis(value: string, from: number): number {
    let depth: number = 1;
    let index: number = from;
    while (index < value.length) {
        const next: number = skipLiteral(value, index);
        if (next !== index) {
            index = next;
            continue;
        }
        if (value[index] === "(") depth++;
        if (value[index] === ")") depth--;
        if (depth === 0) return index;
        index++;
    }
    return -1;
}

function toReference(functionArguments: string): CssVarReference {
    const comma: number = findTopLevelComma(functionArguments);
    if (comma === -1) return { customProperty: functionArguments.trim(), fallback: undefined };
    return {
        customProperty: functionArguments.slice(0, comma).trim(),
        fallback: functionArguments.slice(comma + 1).trim(),
    };
}

function findTopLevelComma(text: string): number {
    let depth: number = 0;
    let index: number = 0;
    while (index < text.length) {
        const next: number = skipLiteral(text, index);
        if (next !== index) {
            index = next;
            continue;
        }
        if (text[index] === "(") depth++;
        if (text[index] === ")") depth--;
        if (text[index] === "," && depth === 0) return index;
        index++;
    }
    return -1;
}

/**
 * Returns the index after the string or comment that starts at the index.
 * Returns the index itself when no string or comment starts there.
 */
function skipLiteral(text: string, index: number): number {
    const first: string = text[index];
    if (first === "\"" || first === "'") return skipString(text, index);
    if (!text.startsWith("/*", index)) return index;
    const end: number = text.indexOf("*/", index + 2);
    return end === -1 ? text.length : end + 2;
}

function skipString(text: string, start: number): number {
    const quote: string = text[start];
    for (let index: number = start + 1; index < text.length; index++) {
        if (text[index] === "\\") index++;
        else if (text[index] === quote) return index + 1;
    }
    return text.length;
}
