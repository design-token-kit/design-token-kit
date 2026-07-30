interface TokenDocument {
    [key: string]: unknown;
}

interface TokenDocumentEntry {
    path: string[];
    token: unknown;
}

/**
 * Builds nested DTCG token documents from flat token entries.
 */
export class TokenDocumentBuilder {

    build(tokens: TokenDocumentEntry[]): TokenDocument {
        return this.buildFrom({}, tokens);
    }

    buildFrom(baseDocument: TokenDocument, tokens: TokenDocumentEntry[]): TokenDocument {
        const document: TokenDocument = cloneDocument(baseDocument);

        for (const entry of tokens) {
            this.#writeToken(document, entry);
        }

        return document;
    }

    #writeToken(document: TokenDocument, entry: TokenDocumentEntry): void {
        let target: TokenDocument = document;

        for (const segment of entry.path.slice(0, -1)) {
            if (!isRecord(target[segment])) {
                target[segment] = {};
            }
            target = target[segment] as TokenDocument;
        }

        target[entry.path[entry.path.length - 1]!] = entry.token;
    }

}

function cloneDocument(document: TokenDocument): TokenDocument {
    return JSON.parse(JSON.stringify(document)) as TokenDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
